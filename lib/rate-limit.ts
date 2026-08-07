import { env } from "@/lib/env";

/**
 * Simple in-memory sliding-window rate limiter (per IP).
 * Suitable for single-instance deployments; swap for Redis in multi-instance setups.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string): {
  ok: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const window = env.RATE_LIMIT_WINDOW_MS;
  const max = env.RATE_LIMIT_MAX;
  const windowStart = now - window;

  const existing = (hits.get(key) ?? []).filter((t) => t > windowStart);
  existing.push(now);
  hits.set(key, existing);

  if (existing.length > max) {
    const oldest = existing[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + window - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  return { ok: true, retryAfterSec: 0 };
}

export function rateLimitByIp(ip: string, action: string) {
  return rateLimit(`${action}:${ip}`);
}

// Prevent unbounded growth of the map.
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of hits) {
    if (!times.length || times[times.length - 1] < now - env.RATE_LIMIT_WINDOW_MS) {
      hits.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();