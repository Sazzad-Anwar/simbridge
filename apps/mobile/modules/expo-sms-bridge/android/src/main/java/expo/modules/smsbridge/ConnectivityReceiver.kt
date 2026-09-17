package expo.modules.smsbridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.os.Build

/**
 * ConnectivityReceiver — manifest-declared fallback for connectivity changes
 * (works when the JS layer and the dynamic callback are not yet attached).
 */
class ConnectivityReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ConnectivityManager.CONNECTIVITY_ACTION &&
        intent.action != "android.net.conn.CONNECTIVITY_CHANGE") {
      return
    }
    val online = ConnectivityMonitor.isOnline(context)
    SmsEventHub.emitConnectivity(online)
  }
}
