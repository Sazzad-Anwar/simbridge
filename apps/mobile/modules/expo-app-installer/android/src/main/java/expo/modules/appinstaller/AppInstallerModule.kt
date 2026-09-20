package expo.modules.appinstaller

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

/**
 * SIMBridge native module (Android) — fully in-app APK updates.
 *
 * Exposed to JS as `AppInstaller`:
 *   - canRequestPackageInstalls(): whether this app may install unknown apps
 *   - openInstallPermissionSettings(): opens Android's "allow installs from
 *     this app" screen (called once, only when the permission is missing)
 *   - install(apkPath, expectedSha256?): stream a local APK through a
 *     PackageInstaller session so the OS installs it over the current build
 *
 * Events:
 *   - onInstallPermissionRequired: { } — session creation needs the permission
 *   - onInstallProgress: { progress } — 0..100 while the APK is written
 *   - onInstallFinished: { packageName } — install completed (app relaunch is
 *     attempted automatically; the app restarts on the new build)
 *   - onInstallError: { code, message } — install failed / aborted
 */
class AppInstallerModule : Module() {
  private val installReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val extras = intent.extras ?: return
      val status = extras.getInt(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
      when (status) {
        PackageInstaller.STATUS_PENDING_USER_ACTION -> {
          sendEvent("onInstallProgress", mapOf("progress" to 100))
          launchConfirmIntent(context, extras)
        }
        PackageInstaller.STATUS_SUCCESS -> {
          sendEvent(
            "onInstallFinished",
            mapOf("packageName" to extras.getString(PackageInstaller.EXTRA_PACKAGE_NAME)),
          )
          relaunchApp(context)
        }
        PackageInstaller.STATUS_FAILURE_ABORTED -> {
          sendEvent("onInstallError", mapOf("code" to "ABORTED", "message" to "Installation was cancelled"))
        }
        else -> {
          val message = extras.getString(PackageInstaller.EXTRA_STATUS_MESSAGE)
            ?: "Installation failed (status $status)"
          sendEvent("onInstallError", mapOf("code" to "FAILED", "message" to message))
        }
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AppInstaller")

    Events(
      "onInstallPermissionRequired",
      "onInstallProgress",
      "onInstallFinished",
      "onInstallError",
    )

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      ContextCompat.registerReceiver(
        context,
        installReceiver,
        IntentFilter(INSTALL_RESULT_ACTION),
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
    }

    OnDestroy {
      val context = appContext.reactContext ?: return@OnDestroy
      runCatching { context.unregisterReceiver(installReceiver) }
    }

    Function("canRequestPackageInstalls") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function true
      context.packageManager.canRequestPackageInstalls()
    }

    Function("openInstallPermissionSettings") {
      val context = appContext.reactContext ?: return@Function true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${context.packageName}"),
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
      }
      return@Function true
    }

    AsyncFunction("install") { apkPath: String, expectedSha256: String? ->
      val context = appContext.reactContext ?: throw IllegalStateException("No application context")
      installApk(context, apkPath, expectedSha256)
      return@AsyncFunction Unit
    }
  }

  private fun installApk(context: Context, apkPath: String, expectedSha256: String?) {
    if (!canRequestPackageInstalls(context)) {
      sendEvent(
        "onInstallPermissionRequired",
        mapOf("needSettings" to true),
      )
      return
    }

    val file = File(apkPath)
    val sessionParams = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    sessionParams.setAppPackageName(context.packageName)

    val packageInstaller = context.packageManager.packageInstaller
    var session: PackageInstaller.Session? = null
    try {
      if (!file.isFile) throw IllegalStateException("Downloaded APK not found")
      verifySha256(file, expectedSha256)

      val sessionId = packageInstaller.createSession(sessionParams)
      session = packageInstaller.openSession(sessionId)

      val size = file.length()
      val output = session.openWrite("SIMBridge.apk", 0, size)
      var written = 0L
      FileInputStream(file).use { input ->
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          output.write(buffer, 0, read)
          written += read
          val pct = if (size > 0) ((written * 100) / size).toInt().coerceIn(0, 99) else 0
          sendEvent("onInstallProgress", mapOf("progress" to pct))
        }
      }
      session.fsync(output)
      output.close()

      // Android resolves the confirmation/status against our app; this fires
      // INSTALL_RESULT_ACTION with PACKAGE_INSTALLER_* status extras.
      val statusIntent = Intent(INSTALL_RESULT_ACTION).setPackage(context.packageName)
      val pendingIntent = android.app.PendingIntent.getBroadcast(
        context,
        (written and Int.MAX_VALUE.toLong()).toInt(), // deterministic per-session request code
        statusIntent,
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE,
      )
      session.commit(pendingIntent.intentSender)
    } catch (e: SecurityException) {
      sendEvent("onInstallPermissionRequired", mapOf("needSettings" to true))
    } catch (e: Exception) {
      val message = e.message ?: "Installation failed"
      sendEvent("onInstallError", mapOf("code" to "FAILED", "message" to message))
    } finally {
      runCatching { session?.close() }
    }
  }

  private fun verifySha256(file: File, expectedSha256: String?) {
    if (expectedSha256 == null) return
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        digest.update(buffer, 0, read)
      }
    }
    val actual = digest.digest().joinToString("") { "%02x".format(it) }
    if (!actual.equals(expectedSha256.lowercase(), ignoreCase = true)) {
      throw IllegalStateException("Checksum mismatch — refusing to install a tampered APK")
    }
  }

  private fun canRequestPackageInstalls(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
    return context.packageManager.canRequestPackageInstalls()
  }

  private fun launchConfirmIntent(context: Context, extras: android.os.Bundle) {
    @Suppress("DEPRECATION")
    val confirm: Intent? = extras.getParcelable(Intent.EXTRA_INTENT)
    confirm
      ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ?.let { runCatching { context.startActivity(it) } }
  }

  private fun relaunchApp(context: Context) {
    runCatching {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return@runCatching
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED,
      )
      context.startActivity(launch)
    }
  }

  private companion object {
    const val INSTALL_RESULT_ACTION = "app.simbridge.mobile.PACKAGE_INSTALLED"
    const val DEFAULT_BUFFER_SIZE = 64 * 1024
  }
}