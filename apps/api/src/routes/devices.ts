import { Elysia, t } from "elysia";
import { authGuard } from "../auth/guard.js";
import { Device } from "../db/models/device.js";
import { Pair } from "../db/models/pair.js";
import { SimSubscription } from "../db/models/sim.js";
import { toDeviceDTO } from "../services/pairing.js";
import { errors } from "../utils/errors.js";
import { consumeChallenge } from "../services/challenges.js";
import {
  base64ToBytes,
  fingerprintOf,
  isValidSigningPublicKey,
  verifyKeyPossession,
} from "@simbridge/crypto";
import { isValidPhoneNumber, normalizePhoneNumber } from "@simbridge/shared";
import type { DeviceDTO, SimInfo } from "@simbridge/shared";

const SimBody = t.Object({
  subscriptionId: t.Number({ minimum: 0 }),
  carrierName: t.Optional(t.String({ maxLength: 120 })),
  slotIndex: t.Optional(t.Number({ minimum: 0, maximum: 7 })),
  displayName: t.Optional(t.String({ maxLength: 120 })),
  phoneNumber: t.Optional(t.String({ maxLength: 40 })),
  isActive: t.Optional(t.Boolean()),
});

async function simsOf(deviceId: string): Promise<SimInfo[]> {
  const sims = await SimSubscription.find({ deviceId })
    .sort({ slotIndex: 1, subscriptionId: 1 })
    .lean<Array<SimInfo & { deviceId: string; _id: unknown }>>();
  return sims.map((s) => ({
    subscriptionId: s.subscriptionId,
    carrierName: s.carrierName ?? "",
    slotIndex: s.slotIndex ?? 0,
    displayName: s.displayName ?? s.carrierName ?? `SIM ${s.subscriptionId}`,
    phoneNumber: s.phoneNumber,
    isActive: s.isActive ?? true,
  }));
}

async function deviceWithSims(deviceId: string): Promise<DeviceDTO> {
  const device = await Device.findOne({ deviceId }).lean();
  if (!device) throw new Error("device disappeared");
  return toDeviceDTO(device, await simsOf(deviceId));
}

export const deviceRoutes = new Elysia({ prefix: "/me", tags: ["devices"] })
  .use(authGuard)
  .get(
    "/",
    async ({ auth }) => ({ ok: true as const, data: await deviceWithSims(auth.deviceId) }),
    { detail: { summary: "Get the current device profile (with SIM registry)" } },
  )
  .patch(
    "/",
    async ({ auth, body }) => {
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) {
        const name = normalizePhoneNumber(body.name);
        if (!isValidPhoneNumber(name)) {
          throw errors.validation("name must be a phone number (e.g. +15551234567)");
        }
        const taken = await Device.findOne({
          name,
          deviceId: { $ne: auth.deviceId },
        })
          .select("_id")
          .lean();
        if (taken) throw errors.duplicate();
        patch.name = name;
      }
      if (body.pushToken !== undefined) patch.pushToken = body.pushToken;

      // --- Signing-key add/rotation (PoP-gated) ----------------------------
      // Adding a signing key hardens this device (legacy V0 -> V1). Rotating
      // it must be proven with a signature from the EXISTING registered key,
      // so a leaked secondary key alone can never self-replace the identity.
      if (
        body.signingPublicKey !== undefined ||
        body.signingKeyFingerprint !== undefined ||
        body.challengeId !== undefined ||
        body.challengePoP !== undefined
      ) {
        const { signingPublicKey, challengeId, challengePoP } = body;
        // All-or-nothing: a partial signing-key update is a client bug.
        if (!signingPublicKey || !challengeId || !challengePoP) {
          throw errors.validation(
            "signingPublicKey, challengeId and challengePoP must be provided together",
          );
        }
        if (!isValidSigningPublicKey(signingPublicKey)) {
          throw errors.validation("signingPublicKey must be a base64-encoded 32-byte Ed25519 key");
        }

        const current = await Device.findOne({ deviceId: auth.deviceId })
          .select("publicKey signingPublicKey")
          .lean<{ publicKey: string; signingPublicKey?: string } | null>();
        if (!current) throw errors.notFound("device");

        const expectedFingerprint = fingerprintOf(current.publicKey, signingPublicKey);
        if (body.signingKeyFingerprint && body.signingKeyFingerprint !== expectedFingerprint) {
          throw errors.validation("signingKeyFingerprint does not match the supplied keys");
        }

        const challenge = base64ToBytes(
          await consumeChallenge({
            challengeId,
            purpose: "rekey",
            deviceId: auth.deviceId,
          }),
        );

        // Rotating an existing key must be proven with the CURRENTLY registered
        // key; adding a key to a legacy device is self-attestation. Both are one
        // single-use consumed challenge. Verifying against current==submitted
        // covers the idempotent re-assertion case naturally.
        const attestationKey = current.signingPublicKey ?? signingPublicKey;
        if (!verifyKeyPossession(attestationKey, challenge, challengePoP)) {
          throw errors.invalidSignature("Proof of possession failed — signing key not updated");
        }

        patch.signingPublicKey = signingPublicKey;
        patch.signingKeyFingerprint = expectedFingerprint;
        patch.keysProvenAt = new Date();
        patch.protocolVersion = 1;

        if (current.signingPublicKey !== signingPublicKey) {
          // Keep the sender pin of every active pair in lockstep with the live
          // key so the receiver always sees a coherent (key, fingerprint) pair.
          // A rotation clears the receiver's confirmation until they re-verify
          // the new fingerprint (verified V1 resumes only after that).
          await Pair.updateMany(
            { senderDeviceId: auth.deviceId, status: "active" },
            {
              $set: {
                pinnedSenderSignKey: signingPublicKey,
                pinnedSenderSignKeyFingerprint: expectedFingerprint,
                receiverFingerprintConfirmed: false,
              },
            },
          );
        }
      }

      await Device.updateOne({ deviceId: auth.deviceId }, { $set: patch });
      return { ok: true as const, data: await deviceWithSims(auth.deviceId) };
    },
    {
      detail: {
        summary: "Update device profile (name = phone number, push token, signing key)",
        description:
          "Adding or rotating the device signing key requires a signed proof-of-possession over a fresh single-use /auth/challenge/rekey challenge. Rotation of an existing key must be proven with the currently registered key.",
      },
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 30 })),
        pushToken: t.Optional(t.String({ maxLength: 500 })),
        signingPublicKey: t.Optional(t.String({ minLength: 40, maxLength: 100 })),
        signingKeyFingerprint: t.Optional(t.String({ minLength: 40, maxLength: 200 })),
        challengeId: t.Optional(t.String({ minLength: 4, maxLength: 64 })),
        challengePoP: t.Optional(t.String({ minLength: 64, maxLength: 200 })),
      }),
    },
  )
  .get(
    "/sims",
    async ({ auth }) => ({ ok: true as const, data: await simsOf(auth.deviceId) }),
    { detail: { summary: "List registered SIM subscriptions" } },
  )
  .put(
    "/sims",
    async ({ auth, body }) => {
      if (body.sims.length > 8) {
        throw errors.validation("At most 8 SIMs per device");
      }
      // Replace-all semantics for the SIM subscription registry.
      await SimSubscription.deleteMany({ deviceId: auth.deviceId });
      if (body.sims.length > 0) {
        await SimSubscription.insertMany(
          body.sims.map((s) => ({
            deviceId: auth.deviceId,
            subscriptionId: s.subscriptionId,
            carrierName: s.carrierName ?? "",
            slotIndex: s.slotIndex ?? 0,
            displayName: s.displayName ?? s.carrierName ?? `SIM ${s.subscriptionId}`,
            phoneNumber: s.phoneNumber,
            isActive: s.isActive ?? true,
          })),
        );
      }
      return { ok: true as const, data: await simsOf(auth.deviceId) };
    },
    {
      detail: {
        summary: "Replace the SIM subscription registry for this device",
        description: "Sent by the sender app whenever the SIM/SubscriptionManager reports a change.",
      },
      body: t.Object({ sims: t.Array(SimBody, { maxItems: 8 }) }),
    },
  );
