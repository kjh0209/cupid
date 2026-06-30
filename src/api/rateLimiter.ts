/**
 * Simple in-memory sliding-window rate limiter.
 * No external dependencies — suitable for a single-instance server.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = opts.windowMs;
    this.maxRequests = opts.maxRequests;
  }

  /**
   * Returns true if the request should be allowed, false if rate-limited.
   */
  consume(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxRequests) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  /**
   * Returns remaining requests for the key.
   */
  remaining(key: string): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const entry = this.store.get(key);
    if (!entry) return this.maxRequests;
    const recent = entry.timestamps.filter((t) => t > cutoff).length;
    return Math.max(0, this.maxRequests - recent);
  }
}

/** Rate limiter for auth endpoints: 10 attempts per 15 minutes per IP */
export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

/** General API rate limiter: 100 requests per minute per IP */
export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});
