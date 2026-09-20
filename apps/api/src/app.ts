import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { env } from './config/env.js'
import { ApiError, errors } from './utils/errors.js'
import { logger } from './utils/logger.js'
import { checkRateLimit } from './services/ratelimit.js'
import { authRoutes } from './routes/auth.js'
import { deviceRoutes } from './routes/devices.js'
import { pairRoutes } from './routes/pairs.js'
import { messageRoutes } from './routes/messages.js'
import { statusRoutes } from './routes/status.js'

/** Route buckets with dedicated limits (requests per window). */
const RATE_BUCKETS: Array<{ match: RegExp; max: number }> = [
  { match: /^\/auth\/(register|token|challenge)/, max: 60 },
  { match: /^\/messages/, max: 600 },
]

export function createApp() {
  const app = new Elysia({ name: 'simbridge-api' })
    .use(
      swagger({
        path: '/docs',
        documentation: {
          info: {
            title: 'SIMBridge API',
            version: env.version,
            description:
              'Reliable SMS relay with offline support, end-to-end encryption and real-time delivery.\n\n' +
              '**Privacy model**: the backend only ever stores and relays encrypted payloads ' +
              '(X25519 + XSalsa20-Poly1305). It never sees plaintext messages.',
          },
          tags: [
            {
              name: 'auth',
              description: 'Device registration & token issuance',
            },
            {
              name: 'devices',
              description: 'Device profile & SIM subscription registry',
            },
            {
              name: 'pairing',
              description: 'Sender ↔ receiver pairing with 6-digit codes',
            },
            {
              name: 'messages',
              description:
                'Encrypted message ingestion, sync and acknowledgements',
            },
            { name: 'meta', description: 'Health, stats & status' },
          ],
        },
      }),
    )
    .use(
      cors({
        origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      }),
    )
    .onRequest(async ({ request, set }) => {
      // Global rate limiting (per IP + bucket).
      const url = new URL(request.url)
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
      const bucket = RATE_BUCKETS.find((b) => b.match.test(url.pathname))
      const result = await checkRateLimit(
        `${ip}:${bucket ? url.pathname : 'general'}`,
        env.rateLimitWindowMs,
        bucket?.max ?? env.rateLimitMax,
      )
      if (!result.allowed) {
        set.headers['retry-after'] = String(Math.ceil(result.resetMs / 1000))
        throw errors.rateLimited(Math.ceil(result.resetMs / 1000))
      }
    })
    .onError(({ error, code, set }) => {
      if (error instanceof ApiError) {
        set.status = error.status
        if (
          error.code === 'RATE_LIMITED' &&
          typeof error.meta?.retryAfterSeconds === 'number'
        ) {
          set.headers['retry-after'] = String(error.meta.retryAfterSeconds)
        }
        return {
          ok: false as const,
          error: { code: error.code, message: error.message },
        }
      }
      if (code === 'VALIDATION') {
        set.status = 422
        const first = (error as { all?: Array<{ summary?: string }> }).all?.[0]
          ?.summary
        return {
          ok: false as const,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: first ?? error.message,
          },
        }
      }
      if (code === 'NOT_FOUND') {
        set.status = 404
        return {
          ok: false as const,
          error: { code: 'NOT_FOUND' as const, message: 'Route not found' },
        }
      }
      if (code === 'PARSE') {
        set.status = 400
        return {
          ok: false as const,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Malformed JSON body',
          },
        }
      }
      logger.error('unhandled error', {
        err: String(error),
        code: String(code),
      })
      set.status = 500
      return {
        ok: false as const,
        error: { code: 'INTERNAL' as const, message: 'Internal server error' },
      }
    })
    .use(statusRoutes)
    .use(authRoutes)
    .use(deviceRoutes)
    .use(pairRoutes)
    .use(messageRoutes)

  return app
}
