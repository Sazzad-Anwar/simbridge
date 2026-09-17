# 🔗 SIMBridge

**Your SIM. Your messages. Anywhere.**

Reliable SMS relay with offline support, end-to-end encryption and real-time delivery — built exactly to the architecture spec: **Turborepo** monorepo, **Elysia.js + Socket.IO** backend, **local MongoDB**, and a **React Native (Expo)** mobile app with sender/receiver roles plus a native Kotlin SMS layer.

```
┌─────────────────────┐      ┌──────────────────────────────┐      ┌─────────────────────┐
│  Sender Android App │      │  Backend (Elysia.js+Sock.IO) │      │ Receiver Mobile App │
│  RN + Kotlin module │◄────►│  REST API  │  Socket.IO WSS  │◄────►│  RN + Socket client │
│  SmsBroadcastRecvr  │HTTPS │  MongoDB (local, encrypted)  │ WSS  │  Inbox, decrypt only│
│  Encrypted outbox   │ WSS  │  TTL · Audit · Rate limiting │      │  Notifications      │
└─────────────────────┘      └──────────────────────────────┘      └─────────────────────┘
```

## Monorepo layout

| Path | Package | Purpose |
|---|---|---|
| `apps/api` | `@simbridge/api` | Elysia.js REST + Socket.IO + Mongoose (Node.js runtime), background workers, Swagger UI, status dashboard |
| `apps/mobile` | `@simbridge/mobile` | Expo (SDK 57 / RN 0.86) app — sender & receiver roles, expo-router screens, `modules/expo-sms-bridge` native Kotlin module |
| `packages/shared` | `@simbridge/shared` | Domain types, Socket.IO event contracts, constants |
| `packages/crypto` | `@simbridge/crypto` | E2E encryption (X25519 + XSalsa20-Poly1305 via tweetnacl) — runs on Node **and** React Native |

## Quickstart

```bash
pnpm install                     # installs all workspaces (auto-builds shared packages)

# 1) Start a LOCAL MongoDB — pick one:
pnpm mongo:local                 # downloads & runs mongod locally (no Docker needed)
# or
pnpm db:up                       # docker compose (mongo:8 + optional mongo-express UI)

# 2) Run the backend (port 3000)
pnpm dev                         # turbo dev → API on http://localhost:3000
```

Open:
- **`/`** — live status dashboard (devices, pairs, messages, WS clients, mongo health)
- **`/docs`** — Swagger UI for all 13 REST endpoints
- **`/health`** — health JSON

### E2E verification

```bash
pnpm smoke                       # 22-check end-to-end test against the running API
```

Covers: registration → pairing → real-time delivery → E2E decrypt → acks → offline ingestion → dedup → reconnect sync.

## Configuration (`apps/api/.env`, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP + WebSocket port (single port) |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/simbridge` | **Local MongoDB** connection |
| `JWT_SECRET` | dev value | Change in production |
| `MESSAGE_TTL_DAYS` | `7` | MongoDB TTL auto-purge of old messages |
| `PAIRING_CODE_TTL_MINUTES` | `10` | 6-digit pairing code lifetime |
| `REDIS_URL` | *(empty)* | Optional — enables Socket.IO Redis adapter + Redis rate limiting for multi-instance deployments |
| `PUSH_SERVICE_URL` | *(empty)* | Optional FCM/APNs relay for background pushes |

## Feature flow (implemented)

1. **Device registration** — app generates an X25519 identity key pair locally, registers the public key, receives `deviceId` + `apiKey` (stored hashed) + JWT.
2. **Role selection** — Sender or Receiver.
3. **Pairing request** — sender creates a request; receiver gets a Socket.IO `pairing:incoming` + push; receiver accepts with the 6-digit code; a unique room is created and both devices' sockets auto-join.
4. **SMS received (sender)** — native `SmsBroadcastReceiver` fires (background, locked screen ok), SIM identified by `subscriptionId`, message **encrypted with the receiver's public key**, saved to the local encrypted outbox, then sent via Socket.IO (ack) with REST fallback.
5. **Offline handling** — `PENDING` outbox entries retry automatically on reconnect (connectivity event + periodic worker); REST ingestion is idempotent per `(pairId, clientMsgId)`; MongoDB persists with TTL.
6. **Real-time delivery** — emitted to the receiver's device room; receiver acks; sender gets `message:delivered`; outbox updated to DELIVERED.
7. **Message sync** — on app start / reconnect the client fetches missed messages after its last-seen `seq` cursor (per-pair monotonic counter), decrypts locally, marks delivered.

## Security & privacy

- **End-to-end encryption** — hybrid ECIES: ephemeral X25519 + XSalsa20-Poly1305 (`tweetnacl.box`). The backend stores and relays `{ ciphertext, ephemPublicKey, nonce }` blobs only — **it never sees plaintext**.
- **Device-bound keys** — mobile keys live in the Android Keystore via `expo-secure-store`; sender outbox plaintext never leaves the device.
- **JWT auth** on every REST route (Bearer) and every Socket.IO handshake.
- **Rate limiting** per IP+bucket (Redis-backed when `REDIS_URL` is set).
- **Audit logs** with 30-day TTL; **message TTL** auto-purge; pairing codes expire in 10 minutes.
- **Validation** on every route body via TypeBox schemas + Swagger documentation.

## Mobile app

```bash
cd apps/mobile
pnpm android        # dev build (REQUIRED for native SMS features)
pnpm start          # or: expo start
```

- Built with **Expo SDK 57 / React Native 0.86 / expo-router**.
- Native module `modules/expo-sms-bridge` (Kotlin): `SmsBroadcastReceiver`, SIM/Subscription manager, `ForegroundService` (`remoteMessaging` type for Android 14+), Keystore-encrypted outbox (`EncryptedSharedPreferences`), connectivity watcher — autolinked via the `modules/` directory.
- Required permissions declared in `app.json`: `RECEIVE_SMS`, `READ_SMS`, `SEND_SMS`, `READ_PHONE_STATE`, `FOREGROUND_SERVICE(_REMOTE_MESSAGING)`, `POST_NOTIFICATIONS`, `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`.
- In **Expo Go** the UI works (pairing, inbox, sync over sockets) but native SMS detection requires a dev build.

## Production notes

- Stateless API + optional Redis adapter → horizontal scaling of Socket.IO.
- Docker-compose included (`mongo` + `mongo-express` under the `ui` profile).
- `pnpm build` / `pnpm typecheck` run across all workspaces via Turbo.
- Worker services handle stale-device cleanup, delivery retries and pairing-code purges.
