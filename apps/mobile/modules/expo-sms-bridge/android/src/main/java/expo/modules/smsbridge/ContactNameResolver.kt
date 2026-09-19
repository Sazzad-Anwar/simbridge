package expo.modules.smsbridge

import android.content.Context
import android.provider.ContactsContract

/**
 * Best-effort contact-name lookup for an incoming SMS number. Requires
 * READ_CONTACTS to be granted; returns null otherwise so the pipeline keeps
 * relaying the bare number without ever crashing on permission state.
 */
object ContactNameResolver {
  fun resolve(context: Context, phoneNumber: String): String? {
    if (phoneNumber.isBlank()) return null
    val want = phoneNumber.filter { it.isDigit() }.takeLast(10)
    if (want.isEmpty()) return null
    return try {
      context.contentResolver.query(
        ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
        arrayOf(
          ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
          ContactsContract.CommonDataKinds.Phone.NORMALIZED_NUMBER,
          ContactsContract.CommonDataKinds.Phone.NUMBER,
        ),
        null,
        null,
        null,
      )?.use { cursor ->
        val nameIdx = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
        val normIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NORMALIZED_NUMBER)
        val numIdx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
        var found: String? = null
        while (cursor.moveToNext()) {
          val matches: Boolean
          if (normIdx >= 0) {
            matches = cursor.getString(normIdx)
              ?.filter { it.isDigit() }
              ?.takeLast(10) == want
          } else {
            matches = cursor.getString(numIdx)
              ?.filter { it.isDigit() }
              ?.takeLast(10) == want
          }
          if (matches) {
            found = cursor.getString(nameIdx)?.trim()
            if (!found.isNullOrEmpty()) break
          }
        }
        found?.takeIf { it.isNotBlank() }
      }
    } catch (_: Exception) {
      null
    }
  }
}