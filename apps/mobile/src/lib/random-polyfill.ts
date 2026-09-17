/**
 * Randomness polyfill for tweetnacl on React Native.
 * MUST be imported before @simbridge/crypto anywhere in the app.
 */
import * as Crypto from "expo-crypto";

const g = globalThis as unknown as {
  crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array };
};

if (!g.crypto || typeof g.crypto.getRandomValues !== "function") {
  (g as { crypto: { getRandomValues: (b: Uint8Array) => Uint8Array } }).crypto = {
    getRandomValues: (bytes: Uint8Array) => {
      Crypto.getRandomValues(bytes);
      return bytes;
    },
  } as never;
}

export {};
