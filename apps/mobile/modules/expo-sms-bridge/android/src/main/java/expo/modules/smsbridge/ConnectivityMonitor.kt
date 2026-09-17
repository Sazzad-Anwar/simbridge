package expo.modules.smsbridge

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest

/**
 * ConnectivityMonitor — watches the default network and emits
 * onConnectivityChanged so the JS layer retries the pending outbox the
 * moment the internet returns (Offline-to-Online Recovery Flow).
 */
object ConnectivityMonitor {

  @Volatile
  private var lastOnline: Boolean? = null
  private var registered = false

  fun start(context: Context) {
    if (registered) return
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
    val request = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()

    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        notify(context, true)
      }

      override fun onLost(network: Network) {
        notify(context, isOnline(context))
      }
    }
    try {
      cm.registerNetworkCallback(request, callback)
      registered = true
    } catch (_: Exception) {
    }
    notify(context, isOnline(context))
  }

  private fun notify(context: Context, online: Boolean) {
    if (lastOnline == online) return
    lastOnline = online
    SmsEventHub.emitConnectivity(online)
  }

  fun isOnline(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
    val network = cm.activeNetwork ?: return false
    val caps = cm.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }
}
