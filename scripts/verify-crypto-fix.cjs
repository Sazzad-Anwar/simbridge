/**
 * Functional verification for the random-polyfill / PRNG fix.
 *
 * Scenario A — normal Node run (globalThis.crypto present natively).
 * Scenario B — simulates React Native: globalThis.crypto does NOT exist when
 *              @simbridge/crypto is loaded (tweetnacl captures no PRNG), and
 *              the expo-crypto polyfill is only installed LATER. With the old
 *              code (nacl.box.keyPair / load-time PRNG) keygen would throw;
 *              with the new call-time randomBytes() it must succeed once the
 *              polyfill is installed before the first CALL.
 *
 * Also proves encrypt/decrypt round-trip and cross-compat with
 * tweetnacl's own box.keyPair (receiver side unchanged).
 */
const assert = require("node:assert");

function loadCryptoDist() {
  // fresh require each scenario
  delete require.cache[require.resolve("/home/z/my-project/packages/crypto/dist/index.js")];
  return require("/home/z/my-project/packages/crypto/dist/index.js");
}

/** Emulates apps/mobile/src/lib/random-polyfill.ts using node:crypto webcrypto. */
function installPolyfill() {
  const { webcrypto } = require("node:crypto");
  const g = globalThis;
  if (!g.crypto || typeof g.crypto.getRandomValues !== "function") {
    Object.defineProperty(g, "crypto", {
      configurable: true,
      value: { getRandomValues: (b) => webcrypto.getRandomValues(b) },
    });
  }
}

async function main() {
  const nacl = require("/home/z/my-project/packages/crypto/node_modules/tweetnacl");

  // ---------- Scenario A: Node as-is ----------
  const cryptoA = loadCryptoDist();
  const kp = cryptoA.generateKeyPair();
  assert.equal(kp.publicKey.length, 44, "publicKey is base64 of 32 bytes");
  assert.equal(kp.secretKey.length, 44, "secretKey is base64 of 32 bytes");
  // publicKey must equal scalarMult.base(secretKey)
  const sk = cryptoA.base64ToBytes(kp.secretKey);
  const derived = cryptoA.bytesToBase64(nacl.scalarMult.base(sk));
  assert.equal(derived, kp.publicKey, "publicKey derives from secretKey (X25519)");
  const msg = "hello from SIMBridge ✓ ünïcode";
  const sealed = cryptoA.encrypt(kp.publicKey, msg);
  const opened = cryptoA.decrypt(kp.secretKey, sealed);
  assert.equal(opened, msg, "encrypt/decrypt round-trip");
  // Interop: seal with tweetnacl's own keyPair, open with ours (and vice versa)
  const foreign = nacl.box.keyPair();
  const sealedForeign = cryptoA.encrypt(
    cryptoA.bytesToBase64(foreign.publicKey),
    msg,
  );
  const openedForeign = cryptoA.decrypt(
    cryptoA.bytesToBase64(foreign.secretKey),
    sealedForeign,
  );
  assert.equal(openedForeign, msg, "interop with nacl.box.keyPair receiver");
  console.log("Scenario A (Node): PASS");

  // ---------- Scenario B: RN-like — no global crypto at load time ----------
  const realCrypto = globalThis.crypto;
  delete globalThis.crypto; // RN/Hermes has no WebCrypto by default
  try {
    const cryptoB = loadCryptoDist(); // tweetnacl evaluated WITHOUT crypto
    let threw = null;
    try {
      cryptoB.generateKeyPair();
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, "before polyfill: keygen must throw (clear error)");
    assert.match(threw.message, /getRandomValues unavailable/, "clear error message");

    installPolyfill(); // polyfill runs AFTER the module was loaded

    const kpB = cryptoB.generateKeyPair(); // call-time lookup -> works now
    const sealedB = cryptoB.encrypt(kpB.publicKey, "offline first");
    assert.equal(cryptoB.decrypt(kpB.secretKey, sealedB), "offline first");
    console.log("Scenario B (RN-like late polyfill): PASS");
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: realCrypto,
    });
  }

  console.log("ALL CHECKS PASS");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
