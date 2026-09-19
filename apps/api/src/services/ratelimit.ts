import { env } from "../config/env.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

interface Store {
  hit(key: string, windowMs: number, max: number): Promise<RateLimitResult>;
}

/** In-memory sliding-window counters. */
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

const store: Store = new MemoryStore();

/** Fixed-window rate limit, keyed by ip + route bucket. */
export async function checkRateLimit(
  key: string,
  windowMs = env.rateLimitWindowMs,
  max = env.rateLimitMax,
): Promise<RateLimitResult> {
  return store.hit(key, windowMs, max);
}