/**
 * Pair-level V1 helpers.
 *
 * V1 (signed envelope) messaging is only enabled for a pair when:
 *   - both devices are hardened (protocolVersion 1) and the pair carries the
 *     sender's pinned signing key, AND
 *   - each device has explicitly confirmed the OTHER device's fingerprint, AND
 *   - the pair is not in a repair state.
 * These predicates never import crypto — they operate purely on PairDTO.
 */

import type { PairDTO } from "./types";

/** Effective message protocol for a pair (1 only when both sides are hardened). */
export function pairProtocolVersion(pair: Pick<PairDTO, "protocolVersion">): 0 | 1 {
  return pair.protocolVersion === 1 ? 1 : 0;
}

/** Whether the pair is on the signed-envelope protocol. */
export function isV1Pair(pair: PairDTO): boolean {
  return pairProtocolVersion(pair) === 1;
}

/** The other device id from my point of view. */
export function peerDeviceId(pair: PairDTO, myDeviceId: string): string {
  return pair.senderDeviceId === myDeviceId ? pair.receiverDeviceId : pair.senderDeviceId;
}

/** Whether I am the sender leg of this pair. */
export function isPairSender(pair: PairDTO, myDeviceId: string): boolean {
  return pair.senderDeviceId === myDeviceId;
}

/**
 * Whether I have confirmed the peer's fingerprint. The receiver confirms the
 * sender's key (that is what authenticates every incoming envelope).
 */
export function iConfirmedPeer(pair: PairDTO, myDeviceId: string): boolean {
  return isPairSender(pair, myDeviceId)
    ? pair.senderFingerprintConfirmed
    : pair.receiverFingerprintConfirmed;
}

/** Whether the peer has confirmed MY fingerprint (their half of the gate). */
export function peerConfirmedMe(pair: PairDTO, myDeviceId: string): boolean {
  return isPairSender(pair, myDeviceId)
    ? pair.receiverFingerprintConfirmed
    : pair.senderFingerprintConfirmed;
}

/** Both sides have pinned and confirmed each other's identities. */
export function isPairVerified(pair: PairDTO): boolean {
  return pair.senderFingerprintConfirmed && pair.receiverFingerprintConfirmed;
}

/**
 * The identity snapshot of the peer (what the user should visually compare).
 * Returns the peer's public key and — when both sides are V1 — its fingerprint.
 */
export function peerIdentity(
  pair: PairDTO,
  myDeviceId: string,
): {
  deviceId: string;
  publicKey: string;
  signingPublicKey?: string;
  signingKeyFingerprint?: string;
} {
  const sender = isPairSender(pair, myDeviceId);
  return {
    deviceId: peerDeviceId(pair, myDeviceId),
    publicKey: sender ? pair.receiverPublicKey ?? "" : pair.senderPublicKey ?? "",
    signingPublicKey: sender ? pair.receiverSigningPublicKey : pair.senderSigningPublicKey,
    signingKeyFingerprint: sender
      ? pair.receiverSigningKeyFingerprint
      : pair.senderSigningKeyFingerprint,
  };
}

/**
 * Strict send/apply gate: V1 messages may only flow when both devices are
 * hardened, both confirmations are set, and the pair is healthy.
 */
export function canUseV1(
  pair: PairDTO,
  myDeviceId: string,
  needsRepair = false,
): boolean {
  if (needsRepair) return false;
  if (!isV1Pair(pair)) return false;
  if (pair.senderSigningKeyFingerprint === undefined || pair.receiverSigningKeyFingerprint === undefined) {
    return false;
  }
  return isPairVerified(pair);
}