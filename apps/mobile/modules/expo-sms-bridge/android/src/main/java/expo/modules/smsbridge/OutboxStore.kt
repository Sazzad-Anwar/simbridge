package expo.modules.smsbridge

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

/**
 * Encrypted Outbox (Local DB) — device-local storage for pending SMS,
 * encrypted at rest with an Android Keystore AES-256 key
 * (EncryptedSharedPreferences). Written by SmsReceiver BEFORE the JS layer
 * runs, so messages survive process death while offline.
 */
object OutboxStore {
  private const val PREFS_FILE = "simbridge.outbox.encrypted"
  private const val KEY_ENTRIES = "entries"

  private fun prefs(context: Context): SharedPreferences {
    val masterKey = MasterKey.Builder(context)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()
    return EncryptedSharedPreferences.create(
      context,
      PREFS_FILE,
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
  }

  @Synchronized
  fun add(context: Context, entry: Map<String, Any?>) {
    try {
      val prefs = prefs(context)
      val arr = JSONArray(prefs.getString(KEY_ENTRIES, "[]") ?: "[]")
      val obj = JSONObject()
      for ((k, v) in entry) obj.put(k, v ?: JSONObject.NULL)
      obj.put("queuedAt", System.currentTimeMillis())
      arr.put(obj)
      prefs.edit().putString(KEY_ENTRIES, arr.toString()).apply()
      SmsEventHub.emit("onOutboxChanged", mapOf("size" to arr.length()))
    } catch (_: Exception) {
      // Never crash the SMS pipeline on storage failure.
    }
  }

  @Synchronized
  fun all(context: Context): JSONArray {
    return try {
      JSONArray(prefs(context).getString(KEY_ENTRIES, "[]") ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }
  }

  @Synchronized
  fun clear(context: Context) {
    try {
      prefs(context).edit().remove(KEY_ENTRIES).apply()
    } catch (_: Exception) {
    }
  }
}
