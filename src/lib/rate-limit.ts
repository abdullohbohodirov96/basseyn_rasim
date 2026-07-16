// Simple in-memory sliding-window limiter. Good enough for per-instance
// protection of sensitive actions (permanent delete, user creation, etc).
// Because Vercel functions are ephemeral this is a best-effort layer, not
// the sole defense - it is combined with role checks and audit logging.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}
