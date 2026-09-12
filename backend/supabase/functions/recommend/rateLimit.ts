/**
 * Per-user request limit.
 *
 * Deliberately modest in what it claims. Edge Functions run as many short-lived
 * isolates, so this state is per-instance and resets on cold start: it is a
 * brake on one signed-in user hammering the endpoint, not a global quota. The
 * real ceiling is the provider's own rate limit.
 *
 * Durable limiting would need a shared store (a Postgres table or Redis). That
 * is worth doing if abuse ever becomes real; it is not worth the write
 * amplification on every request before then.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;
/** Stops the map growing without bound on a long-lived instance. */
const MAX_TRACKED_USERS = 5_000;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. Sent as Retry-After when blocked. */
  retryAfterSeconds: number;
  remaining: number;
}

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now();

  if (windows.size > MAX_TRACKED_USERS) sweep(now);

  const existing = windows.get(userId);

  if (!existing || existing.resetAt <= now) {
    windows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  return {
    allowed: true,
    retryAfterSeconds,
    remaining: MAX_REQUESTS_PER_WINDOW - existing.count,
  };
}
