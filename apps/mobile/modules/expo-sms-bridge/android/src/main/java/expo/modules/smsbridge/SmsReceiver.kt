package expo.modules.smsbridge

import android.annotation.SuppressLint
import android.content.Context
import android.telephony.SmsMessage
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager

/**
 * SmsBroadcastReceiver — detects incoming SMS in the background
 * (even when the app is closed or the phone is locked), identifies the
 * receiving SIM (subscriptionId) and hands the message to the JS layer
 * AND to the encrypted native outbox.
 */
class SmsReceiver : android.content.BroadcastReceiver() {

  @SuppressLint("UnsafeProtectedBroadcastReceiver")
  override fun onReceive(context: Context, intent: android.content.Intent) {
    if (intent.action != android.provider.Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val bundle = intent.extras ?: return
    val messages = TelephonyManagerCompat.getMessagesFromIntent(intent) ?: return
    if (messages.isEmpty()) return

    val subscriptionId = intent.getIntExtra("subscription", -1).let {
      if (it != -1) it else bundle.getInt("subscription", SubscriptionManager.INVALID_SUBSCRIPTION_ID)
    }
    val simInfo = SimInfoReader.listSims(context).firstOrNull {
      (it["subscriptionId"] as Int) == subscriptionId
    }

    for (sms in messages) {
      val body = sms.messageBody ?: continue
      val originating = sms.originatingAddress ?: continue
      val timestamp = sms.timestampMillis

      // 1) Persist to the device-local encrypted outbox FIRST (crash safety).
      OutboxStore.add(
        context,
        mapOf(
          "body" to body,
          "originatingAddress" to originating,
          "timestamp" to timestamp,
          "subscriptionId" to subscriptionId,
          "simDisplayName" to (simInfo?.get("displayName") as? String),
          "status" to "pending"
        )
      )

      // 2) Notify the JS layer for immediate forwarding.
      SmsEventHub.emitSms(
        body = body,
        originatingAddress = originating,
        timestamp = timestamp,
        subscriptionId = subscriptionId,
        simDisplayName = simInfo?.get("displayName") as? String,
        simSlotIndex = (simInfo?.get("slotIndex") as? Number)?.toInt()
      )
    }
  }
}

/** Compat helpers around Telephony.Sms.Intents. */
object TelephonyManagerCompat {
  fun getMessagesFromIntent(intent: android.content.Intent): Array<SmsMessage>? {
    return try {
      val pdus = intent.extras?.get("pdus") as? Array<*> ?: return null
      val format = intent.extras?.getString("format")
      pdus.mapNotNull { pdu ->
        val bytes = pdu as? ByteArray ?: return@mapNotNull null
        SmsMessage.createFromPdu(bytes, format)
      }.toTypedArray()
    } catch (_: Exception) {
      null
    }
  }
}
