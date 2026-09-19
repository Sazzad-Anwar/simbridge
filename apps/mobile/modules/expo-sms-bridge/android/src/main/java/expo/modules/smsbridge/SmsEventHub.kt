package expo.modules.smsbridge

import android.util.Log

/**
 * Lightweight event dispatcher from plain Android components (BroadcastReceiver,
 * Service) into the Expo module's event emitter. SmsBridgeModule registers its
 * emitter here on create; SmsReceiver / ForegroundService / ConnectivityReceiver
 * publish through this hub.
 */
object SmsEventHub {
  private const val TAG = "SmsEventHub"

  @Volatile
  var onEvent: ((name: String, body: Map<String, Any?>) -> Unit)? = null

  fun emit(name: String, body: Map<String, Any?>) {
    Log.d(TAG, "emit $name (listener=${onEvent != null}) body=${body.keys}")
    try {
      onEvent?.invoke(name, body)
    } catch (e: Exception) {
      Log.e(TAG, "event dispatch failed: $name", e)
    }
  }

  fun emitSms(
    body: String,
    originatingAddress: String,
    timestamp: Long,
    subscriptionId: Int,
    simDisplayName: String?,
    simSlotIndex: Int?,
    contactName: String?
  ) {
    emit(
      "onSmsReceived",
      mapOf(
        "body" to body,
        "originatingAddress" to originatingAddress,
        "timestamp" to timestamp,
        "subscriptionId" to subscriptionId,
        "simDisplayName" to simDisplayName,
        "simSlotIndex" to simSlotIndex,
        "contactName" to contactName
      )
    )
  }

  fun emitConnectivity(online: Boolean) {
    emit("onConnectivityChanged", mapOf("online" to online))
  }
}
