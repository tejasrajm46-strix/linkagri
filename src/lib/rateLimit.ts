/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for single-instance deployments (the SIH demo / MVP). For a
 * multi-instance production deployment swap this for a shared store
 * (Redis) behind the same `rateLimit()` signature.
 */

type Bucket = { windowMs: number; hits: number[] };

const buckets = new Map<string, Bucket>();

const CLEANUP_MS = 60_000;
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) {
      while (b.hits.length && b.hits[0] < now - b.windowMs) b.hits.shift();
      if (b.hits.length === 0) buckets.delete(key);
    }
  }, CLEANUP_MS).unref?.();
}

/**
 * Throws an HttpError-shaped object (see apiHelpers.fail) when the limit is
 * exceeded.
 */
export function rateLimit(opts: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}): void {
  const now = Date.now();
  const mapKey = `${opts.scope}:${opts.key}`;
  let bucket = buckets.get(mapKey);
  if (!bucket || bucket.windowMs !== opts.windowMs) {
    bucket = { windowMs: opts.windowMs, hits: [] };
    buckets.set(mapKey, bucket);
  }
  const cutoff = now - opts.windowMs;
  while (bucket.hits.length && bucket.hits[0] < cutoff) bucket.hits.shift();
  if (bucket.hits.length >= opts.limit) {
    throw { status: 429, message: "Too many requests. Please try again shortly." };
  }
  bucket.hits.push(now);
}

/** Human-friendly presets used across routes. */
export const Rate = {
  auth: { limit: 30, windowMs: 60_000 }, // per IP: logins / role switches
  chat: { limit: 40, windowMs: 60_000 }, // per user
  action: { limit: 30, windowMs: 60_000 }, // per user: offers, pickup, disputes, logistics
  payment: { limit: 15, windowMs: 60_000 },
  admin: { limit: 120, windowMs: 60_000 },
  general: { limit: 120, windowMs: 60_000 },
};
