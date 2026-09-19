package expo.modules.smsbridge

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract

/**
 * Best-effort contact-name lookup for an incoming SMS number. Requires
 * READ_CONTACTS to be granted; returns null otherwise so the pipeline keeps
 * relaying the bare number without ever crashing on permission state.
 *
 * Uses ContactsContract.PhoneLookup.CONTENT_FILTER_URI, which resolves against
 * the provider's indexed, normalized number column. This runs on the SMS
 * broadcast thread, so a full-table scan is not acceptable.
 */
object ContactNameResolver {
  fun resolve(context: Context, phoneNumber: String): String? {
    if (phoneNumber.isBlank()) return null
    val digits = phoneNumber.filter { it.isDigit() }
    if (digits.isEmpty()) return null

    // Try the number as-is first; fall back to its last 10 digits so contacts
    // stored with a different country code still match.
    lookup(context, phoneNumber)?.let { return it }
    val suffix = digits.takeLast(10)
    return if (suffix.length == digits.length) null else lookup(context, suffix)
  }

  private fun lookup(context: Context, number: String): String? {
    return try {
      val uri = Uri.withAppendedPath(
        ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
        Uri.encode(number),
      )
      context.contentResolver.query(
        uri,
        arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
        null,
        null,
        null,
      )?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(0)?.trim()?.takeIf { it.isNotEmpty() }
        else null
      }
    } catch (_: Exception) {
      null
    }
  }
}
