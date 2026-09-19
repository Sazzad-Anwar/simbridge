package expo.modules.smsbridge

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * SIMBridge native module (Android).
 *
 * Exposed to JS as `SmsBridge`:
 *   - listSims(): SIM subscriptions from SubscriptionManager (multi-SIM)
 *   - startForegroundService()/stopForegroundService(): keep-alive service
 *   - isServiceRunning()/hasSmsPermissions(): diagnostics
 *   - getOutbox()/clearOutbox(): device-local ENCRYPTED pending messages
 *   - readRecentInbox(afterTimestamp, limit): OS SMS inbox scan (recovery path)
 * Events:
 *   - onSmsReceived: { body, originatingAddress, timestamp, subscriptionId, ... }
 *   - onConnectivityChanged: { online }
 *   - onOutboxChanged: { size }
 */
class SmsBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsBridge")

    Events("onSmsReceived", "onConnectivityChanged", "onOutboxChanged")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      SmsEventHub.onEvent = { name, body ->
        sendEvent(name, body)
      }
      ConnectivityMonitor.start(context)
      // Auto-start the keep-alive service when permissions are granted.
      if (hasSmsPermissions()) {
        ForegroundService.start(context)
      }
    }

    OnDestroy {
      SmsEventHub.onEvent = null
    }

    Function("isServiceRunning") {
      return@Function ForegroundService.isRunning
    }

    Function("hasSmsPermissions") {
      return@Function hasSmsPermissions()
    }

    AsyncFunction("listSims") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(emptyList<Map<String, Any>>())
        return@AsyncFunction
      }
      promise.resolve(SimInfoReader.listSims(context))
    }

    AsyncFunction("readRecentInbox", { afterTimestamp: Long, limit: Int? ->
      val context = appContext.reactContext
      if (context == null) {
        emptyList<Map<String, Any?>>()
      } else {
        InboxReader.readRecent(context, afterTimestamp, limit ?: 200)
      }
    })

    AsyncFunction("startForegroundService") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "Application context unavailable", null)
        return@AsyncFunction
      }
      ForegroundService.start(context)
      promise.resolve(null)
    }

    AsyncFunction("stopForegroundService") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context != null) ForegroundService.stop(context)
      promise.resolve(null)
    }

    Function("getOutbox") {
      val context = appContext.reactContext
      return@Function if (context == null) {
        emptyList<Map<String, Any?>>()
      } else {
        val arr = OutboxStore.all(context)
        buildList {
          for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            add(
              buildMap {
                for (key in obj.keys()) {
                  val v = obj.opt(key)
                  if (v != null && v != org.json.JSONObject.NULL) put(key, v)
                }
              }
            )
          }
        }
      }
    }

    Function("clearOutbox") {
      val context = appContext.reactContext
      if (context != null) OutboxStore.clear(context)
      return@Function null
    }
  }

  private fun hasSmsPermissions(): Boolean {
    val context = appContext.reactContext ?: return false
    return context.checkSelfPermission(android.Manifest.permission.RECEIVE_SMS) ==
      android.content.pm.PackageManager.PERMISSION_GRANTED &&
      context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) ==
      android.content.pm.PackageManager.PERMISSION_GRANTED
  }
}
