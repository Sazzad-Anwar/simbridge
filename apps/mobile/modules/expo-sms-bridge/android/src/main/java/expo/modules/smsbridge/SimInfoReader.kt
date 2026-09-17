package expo.modules.smsbridge

import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.content.Context
import android.os.Build

/**
 * SIM / Subscription Manager — reads active SIM subscriptions (multi-SIM).
 * Mirrors the "SIM/Subscription Manager" block of the architecture spec.
 */
object SimInfoReader {
  fun listSims(context: Context): List<Map<String, Any>> {
    val result = mutableListOf<Map<String, Any>>()
    try {
      val sm = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
        ?: return result
      val subs: List<SubscriptionInfo> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          sm.activeSubscriptionInfoList ?: emptyList()
        } else {
          @Suppress("DEPRECATION")
          sm.activeSubscriptionInfoList ?: emptyList()
        }
      for (sub in subs) {
        result.add(
          mapOf(
            "subscriptionId" to sub.subscriptionId,
            "carrierName" to (sub.carrierName?.toString() ?: ""),
            "slotIndex" to sub.simSlotIndex,
            "displayName" to (sub.displayName?.toString() ?: sub.carrierName?.toString() ?: ""),
            "phoneNumber" to (sub.number ?: ""),
            "isActive" to true
          )
        )
      }
    } catch (_: SecurityException) {
      // READ_PHONE_STATE not granted yet — return empty; UI shows the hint.
    } catch (_: Exception) {
      // Device without telephony support, emulators without SIM, etc.
    }
    return result
  }
}
