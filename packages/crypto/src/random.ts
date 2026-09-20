/**
 * CSPRNG that works on Node.js and React Native.
 *
 * Reads `globalThis.crypto.getRandomValues` LAZILY at call time so randomness
 * never depends on tweetnacl's PRNG, which is captured at module-load time
 * (fragile on React Native). The mobile app polyfills `globalThis.crypto`
 * with expo-crypto at startup (apps/mobile/src/lib/random-polyfill.ts).
 */

export function randomBytes(length: number): Uint8Array {
  const g = globalThis as { crypto?: { getRandomValues(b: Uint8Array): Uint8Array } };
  const crypto = g.crypto;
  if (!crypto || typeof crypto.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues unavailable. On React Native, polyfill it with expo-crypto before importing @simbridge/crypto.",
    );
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}