package expo.modules.smsbridge

import android.content.Context
import android.database.Cursor
import android.net.Uri

/**
 * InboxReader — reads the OS SMS inbox (READ_SMS) as a recovery path.
 *
 * MIUI discards the SMS_RECEIVED broadcast when the app was swiped from
 * recents (AutoStart restriction), so SmsReceiver never runs and the native
 * outbox stays empty. This scans the inbox for messages newer than a JS-held
 * watermark so those missed SMS are still forwarded on next app open / Resync.
 */
object InboxReader {
  private const val SMS_INBOX_URI = "content://sms/inbox"

  fun readRecent(context: Context, afterTimestamp: Long, limit: Int = 200): List<Map<String, Any?>> {
    val result = mutableListOf<Map<String, Any?>>()
    val resolver = try {
      context.contentResolver
    } catch (_: Exception) {
      return result
    }

    val uri = Uri.parse(SMS_INBOX_URI)
    val projection = arrayOf("_id", "address", "date", "body", "sub_id", "subscription")
    var cursor: Cursor? = null
    try {
      cursor = resolver.query(
        uri,
        projection,
        "date > ?",
        arrayOf(afterTimestamp.toString()),
        "date ASC",
      )
      if (cursor == null) return result

      val idxId = cursor.getColumnIndexOrThrow("_id")
      val idxAddress = cursor.getColumnIndex("address")
      val idxDate = cursor.getColumnIndex("date")
      val idxBody = cursor.getColumnIndex("body")
      val idxSubId = cursor.getColumnIndex("sub_id")
      val idxSub = cursor.getColumnIndex("subscription")

      var count = 0
      while (cursor.moveToNext() && count < limit) {
        val address = if (idxAddress >= 0) cursor.getString(idxAddress) else null
        val body = if (idxBody >= 0) cursor.getString(idxBody) else null
        val date = if (idxDate >= 0) cursor.getLong(idxDate) else 0L
        if (address.isNullOrBlank() || body.isNullOrBlank() || date <= afterTimestamp) continue

        var subscriptionId = if (idxSubId >= 0) cursor.getInt(idxSubId) else -1
        if (subscriptionId < 0 && idxSub >= 0) subscriptionId = cursor.getInt(idxSub)
        if (subscriptionId < 0) subscriptionId = 0

        result.add(
          mapOf(
            "id" to cursor.getLong(idxId),
            "originatingAddress" to address,
            "body" to body,
            "timestamp" to date,
            "subscriptionId" to subscriptionId,
          ),
        )
        count++
      }
    } catch (_: SecurityException) {
      // READ_SMS not granted yet — Resync also requests it first.
    } catch (_: Exception) {
    } finally {
      try {
        cursor?.close()
      } catch (_: Exception) {
      }
    }
    return result
  }
}