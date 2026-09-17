package expo.modules.smsbridge

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * Foreground Service (remoteMessaging) — keeps the process alive so incoming
 * SMS are detected reliably even when the app is closed or the phone is
 * locked (required for reliable delivery on Android 14+).
 */
class ForegroundService : Service() {

  override fun onCreate() {
    super.onCreate()
    startForegroundWithType()
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    isRunning = false
    super.onDestroy()
  }

  private fun startForegroundWithType() {
    val channelId = "simbridge.service"
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(
        NotificationChannel(channelId, "SIMBridge background service", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val notification: Notification =
      androidx.core.app.NotificationCompat.Builder(this, channelId)
        .setContentTitle("SIMBridge is active")
        .setContentText("Relaying your SMS securely in the background")
        .setSmallIcon(android.R.drawable.stat_sys_download_done)
        .setOngoing(true)
        .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // Android 14+: must declare the matching foregroundServiceType.
      startForeground(NOTIFICATION_ID, notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val NOTIFICATION_ID = 4711
    @Volatile var isRunning: Boolean = false
      private set

    fun start(context: Context) {
      val intent = Intent(context, ForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, ForegroundService::class.java))
      isRunning = false
    }
  }
}
