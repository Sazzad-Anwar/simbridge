import { Elysia, t } from "elysia";
import { authGuard } from "../auth/guard.js";
import {
  sendMessage,
  acknowledgeMessages,
  syncMessages,
  checkClientMsgIdsExist,
} from "../services/messages.js";

const EncryptedPayloadBody = t.Object({
  ciphertext: t.String({ minLength: 16, maxLength: 64_000 }),
  ephemPublicKey: t.String({ minLength: 16, maxLength: 200 }),
  nonce: t.String({ minLength: 8, maxLength: 200 }),
  scheme: t.Literal("x25519-xsalsa20-poly1305"),
});

export const messageRoutes = new Elysia({ prefix: "/messages", tags: ["messages"] })
  .use(authGuard)
  .post(
    "/",
    async ({ auth, body }) => {
      const result = await sendMessage(
        { deviceId: auth.deviceId, role: auth.role },
        {
          pairId: body.pairId,
          clientMsgId: body.clientMsgId,
          payload: body.payload,
          sim: body.sim,
          from: body.from,
          fromName: body.fromName,
        },
      );
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Ingest an encrypted message (REST fallback for the offline outbox)",
        description:
          "Idempotent per (pairId, clientMsgId). The payload is stored and relayed opaquely — the backend cannot decrypt it.",
      },
      body: t.Object({
        pairId: t.String({ minLength: 4 }),
        clientMsgId: t.String({ minLength: 6, maxLength: 80 }),
        payload: EncryptedPayloadBody,
        sim: t.Optional(
          t.Object({
            subscriptionId: t.Number(),
            carrierName: t.Optional(t.String()),
            slotIndex: t.Optional(t.Number()),
            displayName: t.Optional(t.String()),
            phoneNumber: t.Optional(t.String()),
          }),
        ),
        // Only non-empty: SMS origins can be short codes or alphanumeric
        // sender IDs (e.g. "GP", "16247"), and the socket path applies no
        // length floor — keeping REST identical avoids rejecting cold-start
        // recovery of messages from those senders.
        from: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
        fromName: t.Optional(t.String({ minLength: 1, maxLength: 140 })),
      }),
    },
  )
  .post(
    "/exists",
    async ({ auth, body }) => {
      const result = await checkClientMsgIdsExist({ deviceId: auth.deviceId }, body);
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Check which clientMsgIds already exist in a pair",
        description:
          "Senders call this before enqueueing a batch so messages already stored in the DB are not re-encrypted or re-sent (dedup pre-check).",
      },
      body: t.Object({
        pairId: t.String({ minLength: 4 }),
        clientMsgIds: t.Array(t.String({ minLength: 6, maxLength: 80 }), { maxItems: 500 }),
      }),
    },
  )
  .get(
    "/sync",
    async ({ auth, query }) => {
      const result = await syncMessages(
        { deviceId: auth.deviceId },
        {
          pairId: query.pairId,
          afterSeq: Number(query.afterSeq ?? 0) || 0,
          limit: query.limit ? Number(query.limit) : undefined,
        },
      );
      return { ok: true as const, data: result };
    },
    {
      detail: {
        summary: "Fetch missed messages after a sequence number",
        description: "Step 7 of the feature flow — called on app start / reconnect.",
      },
      query: t.Object({
        pairId: t.String({ minLength: 4 }),
        afterSeq: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/ack",
    async ({ auth, body }) => {
      const result = await acknowledgeMessages({ deviceId: auth.deviceId }, body);
      return { ok: true as const, data: result };
    },
    {
      detail: { summary: "Acknowledge delivery of messages (receiver)" },
      body: t.Object({ messageIds: t.Array(t.String({ minLength: 4 }), { maxItems: 500 }) }),
    },
  );