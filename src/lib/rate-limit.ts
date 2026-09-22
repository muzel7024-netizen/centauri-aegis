/**
 * In-memory sliding window rate limiter.
 *
 * Uses a token bucket with sliding window for smooth rate limiting.
 * Stores state in-process memory — resets on server restart.
 * For production multi-instance deployments, swap for Redis-backed store.
 */

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface ClientRecord {
  /** Timestamps of requests within the current window */
  timestamps: number[];
  /** Last cleanup time */
  lastCleanup: number;
}

/** Default rate limit tiers */
export const RATE_LIMIT_TIERS = {
  /** Auth endpoints — strict to prevent brute force (5 req / 60s) */
  auth: { maxRequests: 5, windowSeconds: 60 },
  /** Attack/chain endpoints — moderate (10 req / 60s, these are long-running) */
  attack: { maxRequests: 10, windowSeconds: 60 },
  /** General API endpoints (30 req / 60s) */
  api: { maxRequests: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

/**
 * Maps URL path prefixes to rate limit tiers.
 * First match wins — order matters (most specific first).
 */
const ROUTE_TIER_MAP: Array<[string, RateLimitTier]> = [
  ["/api/auth/", "auth"],
  ["/api/attack", "attack"],
  ["/api/evolve", "attack"],
  ["/api/chain", "attack"],
  ["/api/generate-adaptive", "attack"],
  ["/api/", "api"],
];

/**
 * Resolve which rate limit tier applies to a given pathname.
 * Returns null for non-API routes (no rate limiting).
 */
export function resolveRateLimitTier(pathname: string): RateLimitTier | null {
  for (const [prefix, tier] of ROUTE_TIER_MAP) {
    if (pathname.startsWith(prefix)) {
      return tier;
    }
  }
  return null;
}

class RateLimiter {
  /**
   * Map of "tier:clientKey" → ClientRecord
   * Using combined key allows different limits per tier per client.
   */
  private clients = new Map<string, ClientRecord>();

  /** Interval handle for periodic cleanup */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /** How often to run global cleanup (ms) */
  private static readonly CLEANUP_INTERVAL_MS = 60_000;

  /** Max idle time before a client record is evicted (ms) */
  private static readonly EVICTION_MS = 300_000; // 5 minutes

  constructor() {
    // Periodic cleanup to prevent memory leaks from abandoned clients
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(
        () => this.globalCleanup(),
        RateLimiter.CLEANUP_INTERVAL_MS
      );
      // Unref so it doesn't keep the process alive
      if (this.cleanupInterval && typeof this.cleanupInterval === "object" && "unref" in this.cleanupInterval) {
        (this.cleanupInterval as NodeJS.Timeout).unref();
      }
    }
  }

  /**
   * Check if a request should be allowed.
   *
   * @param clientKey - Identifier for the client (IP address, session ID, etc.)
   * @param tier - Which rate limit tier to apply
   * @returns Object with allowed status and rate limit metadata
   */
  check(
    clientKey: string,
    tier: RateLimitTier
  ): {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetSeconds: number;
  } {
    const config = RATE_LIMIT_TIERS[tier];
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const bucketKey = `${tier}:${clientKey}`;

    let record = this.clients.get(bucketKey);
    if (!record) {
      record = { timestamps: [], lastCleanup: now };
      this.clients.set(bucketKey, record);
    }

    // Prune timestamps outside the current window
    const cutoff = now - windowMs;
    record.timestamps = record.timestamps.filter((t) => t > cutoff);
    record.lastCleanup = now;

    const remaining = Math.max(0, config.maxRequests - record.timestamps.length);
    const resetSeconds = record.timestamps.length > 0
      ? Math.ceil((record.timestamps[0] + windowMs - now) / 1000)
      : config.windowSeconds;

    if (record.timestamps.length >= config.maxRequests) {
      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetSeconds,
      };
    }

    // Allow the request — record the timestamp
    record.timestamps.push(now);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: remaining - 1,
      resetSeconds,
    };
  }

  /**
   * Remove stale client records to prevent memory leaks.
   */
  private globalCleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.clients) {
      if (now - record.lastCleanup > RateLimiter.EVICTION_MS) {
        this.clients.delete(key);
      }
    }
  }

  /** Get current number of tracked clients (for monitoring) */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Reset all state (for testing) */
  reset(): void {
    this.clients.clear();
  }
}

/** Singleton rate limiter instance */
export const rateLimiter = new RateLimiter();

/**
 * Extract client identifier from a request.
 * Uses X-Forwarded-For (behind proxy), X-Real-IP, or falls back to
 * a generic key for direct connections.
 */
export function getClientKey(request: Request): string {
  const headers = request.headers;

  const isProd = process.env.NODE_ENV === "production";
  const trustProxy =
    process.env.AEGIS_TRUSTED_PROXY === "true" ||
    process.env.TRUSTED_PROXY === "true" ||
    !isProd;

  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "direct";
}

/**
 * Build standard rate limit headers for the response.
 */
export function rateLimitHeaders(result: {
  limit: number;
  remaining: number;
  resetSeconds: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetSeconds),
    "Retry-After": String(result.resetSeconds),
  };
}
