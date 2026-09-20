/**
 * Golden test vectors for the V1 canonical format and Ed25519 signature.
 * These bytes are locked: if the canonical field order, length encoding or
 * magic prefix ever changes, these assertions fail — which is exactly the
 * protection needed since the same bytes are verified independently on
 * sender, backend and receiver.
 *
 * The golden identity keypair below is NEVER stored as key material in this
 * file. Keys are deterministically DERIVED at load time from a fixed, public
 * test seed (see GOLDEN_TEST_SEED) using a cryptographic hash, so the golden
 * vectors reproduce identically on every machine and CI run with no
 * environment secrets.
 */

import nacl from "tweetnacl";
import { CRYPTO_SCHEME } from "./protocol";
import { bytesToBase64, utf8ToBytes } from "./base64";
import { fingerprintOf } from "./identity";

/**
 * PUBLIC TEST FIXTURE MATERIAL — MUST NOT be used in production.
 *
 * The golden identity keys in this module are derived from this fixed,
 * non-secret, PUBLIC test seed via SHA-512. The seed (and therefore every
 * derived "key") is not a credential: anyone can recompute the golden keypair
 * from it. It exists only to make golden tests deterministic and reproducible
 * across machines. It carries no security value and MUST NOT protect real
 * data.
 */
export const GOLDEN_TEST_SEED =
  "simbridge.golden.vectors.v1|PUBLIC TEST FIXTURE MATERIAL|not-a-secret|do-not-use-in-production";

const GOLDEN_ROOT = nacl.hash(utf8ToBytes(GOLDEN_TEST_SEED)); // 64-byte SHA-512

const GOLDEN_ENC_SECRET_KEY_BYTES = GOLDEN_ROOT.subarray(0, 32);
const GOLDEN_SIGN_SEED_BYTES = GOLDEN_ROOT.subarray(32, 64);

/** X25519 secret key (base64) — derived from the PUBLIC test seed; test-only. */
export const GOLDEN_ENC_SECRET_KEY = bytesToBase64(GOLDEN_ENC_SECRET_KEY_BYTES);
/** X25519 public key (base64) derived from the PUBLIC test seed. */
export const GOLDEN_ENC_PUBLIC_KEY = bytesToBase64(
  nacl.scalarMult.base(GOLDEN_ENC_SECRET_KEY_BYTES),
);

const GOLDEN_SIGN_KEYPAIR = nacl.sign.keyPair.fromSeed(GOLDEN_SIGN_SEED_BYTES);
/** Ed25519 secret key (base64) — derived from the PUBLIC test seed; test-only. */
export const GOLDEN_SIGN_SECRET_KEY = bytesToBase64(GOLDEN_SIGN_KEYPAIR.secretKey);
/** Ed25519 public key (base64) derived from the PUBLIC test seed. */
export const GOLDEN_SIGN_PUBLIC_KEY = bytesToBase64(GOLDEN_SIGN_KEYPAIR.publicKey);

/**
 * Fingerprint of the golden identity: first 32 bytes of
 * SHA-512(GOLDEN_ENC_PUBLIC_KEY ‖ GOLDEN_SIGN_PUBLIC_KEY) — derived from the
 * PUBLIC test seed.
 */
export const GOLDEN_FINGERPRINT = fingerprintOf(GOLDEN_ENC_PUBLIC_KEY, GOLDEN_SIGN_PUBLIC_KEY);

/**
 * Alternate signer public key derived from a separate PUBLIC test seed — used
 * by tests asserting that envelopes from an unregistered sender key are
 * rejected. No key material is hard-coded.
 */
export const GOLDEN_OTHER_SIGN_PUBLIC_KEY = (() => {
  const root = nacl.hash(utf8ToBytes(`${GOLDEN_TEST_SEED}|alternate-signer`));
  return bytesToBase64(nacl.sign.keyPair.fromSeed(root.subarray(0, 32)).publicKey);
})();

export const GOLDEN_ENVELOPE = {
  version: 1,
  scheme: CRYPTO_SCHEME,
  messageId: "msg_00000000-0000-4000-8000-000000000001",
  pairId: "pair_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001",
  senderDeviceId: "dev_11111111-2222-4333-8444-555555550001",
  receiverDeviceId: "dev_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002",
  senderSignKeyFingerprint: GOLDEN_FINGERPRINT,
  ephemPublicKey: "Ay6uWi6zY8B9qO7JpN8QvB9fJ0yK4lP3sW7A0qR2X3Q=",
  nonce: "E6tV7qK2pP9sW4nM1bR8cX3jL0mF5gH2dS6aY0uZ9v=",
  ciphertext: "evJxA3nY7mcL8pQ2vR5sT0wK1bD9fG4hN6iE7jU2oX=",
  createdAt: "2026-09-20T10:15:30.000Z",
};

/** Deterministic canonical bytes for GOLDEN_ENVELOPE (hex). */
export const GOLDEN_CANONICAL_HEX =
  "53494d4252494447452f454e56454c4f50452f563100000000010000001b7832353531392d7873616c736132302d706f6c79313330352d7631000000286d73675f30303030303030302d303030302d343030302d383030302d30303030303030303030303100000029706169725f61616161616161612d626262622d346363632d386464642d656565656565656530303031000000286465765f31313131313131312d323232322d343333332d383434342d353535353535353530303031000000286465765f61616161616161612d626262622d346363632d386464642d6565656565656565303030320000002c644e4a54494a71534e2b31495778616c33723174535964766e4a73714473376972593561737454543478343d0000002c417936755769367a59384239714f374a704e3851764239664a30794b346c503373573741307152325833513d0000002b4536745637714b327050397357346e4d316252386358336a4c306d4635674832645336615930755a39763d0000002b65764a7841336e59376d634c38705132765235735430774b31624439664734684e366945376a55326f583d00000018323032362d30392d32305431303a31353a33302e3030305a";

/** Expected Ed25519 signature over GOLDEN_CANONICAL_HEX with GOLDEN_SIGN_SECRET_KEY. */
export const GOLDEN_SIGNATURE =
  "Po9KIkYDTbU3jqPhVJ7PPz1j2VucmELOZ74Oa/78aRiVXavXdb7nktJ4kDpAit/bvUsqXkvmkOKQyimN4/FeBg==";