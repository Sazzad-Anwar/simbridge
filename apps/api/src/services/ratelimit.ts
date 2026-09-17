import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

interface Store {
  hit(key: string, windowMs: number, max: number): Promise<RateLimitResult>;
}

/** In-memory sliding-window counters (default for local development). */
class MemoryStore implements Store {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: max - 1, resetMs: windowMs };
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= max,
      remaining: Math.max(0, max - bucket.count),
      resetMs: bucket.resetAt - now,
    };
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

/** Redis-backed fixed-window counters (enabled when REDIS_URL is set). */
class RedisStore implements Store {
  constructor(private client: { incr(key: string): Promise<number>; pexpire(key: string, ms: number): Promise<number> }) {}

  async hit(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
    const window = Math.floor(Date.now() / windowMs);
    const redisKey = `simbridge:rl:${key}:${window}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) await this.client.pexpire(redisKey, windowMs * 2);
    const resetMs = (window + 1) * windowMs - Date.now();
    return { allowed: count <= max, remaining: Math.max(0, max - count), resetMs };
  }
}

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (store) return store;
  if (env.redisUrl) {
    try {
      const redisModule = await import("ioredis");
      const RedisCtor = redisModule.default as unknown as new (
        url: string,
        opts?: Record<string, unknown>,
      ) => { incr(key: string): Promise<number>; pexpire(key: string, ms: number): Promise<number> };
      const client = new RedisCtor(env.redisUrl, { maxRetriesPerRequest: 1 });
      store = new RedisStore(client);
      logger.info("Rate limiter using Redis");
      return store;
    } catch (err) {
      logger.warn("Redis unavailable for rate limiter; falling back to memory", {
        err: String(err),
      });
    }
  }
  store = new MemoryStore();
  return store;
}

/** Sliding/fixed window rate limit, keyed by ip + route bucket. */
export async function checkRateLimit(
  key: string,
  windowMs = env.rateLimitWindowMs,
  max = env.rateLimitMax,
): Promise<RateLimitResult> {
  const s = await getStore();
  return s.hit(key, windowMs, max);
}
