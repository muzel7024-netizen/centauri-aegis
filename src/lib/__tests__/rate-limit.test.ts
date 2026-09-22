import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  rateLimiter,
  resolveRateLimitTier,
  getClientKey,
  rateLimitHeaders,
  RATE_LIMIT_TIERS,
} from "../rate-limit";

describe("resolveRateLimitTier", () => {
  it("maps auth routes to auth tier", () => {
    expect(resolveRateLimitTier("/api/auth/login")).toBe("auth");
    expect(resolveRateLimitTier("/api/auth/logout")).toBe("auth");
    expect(resolveRateLimitTier("/api/auth/status")).toBe("auth");
  });

  it("maps attack routes to attack tier", () => {
    expect(resolveRateLimitTier("/api/attack")).toBe("attack");
    expect(resolveRateLimitTier("/api/evolve")).toBe("attack");
    expect(resolveRateLimitTier("/api/chain")).toBe("attack");
    expect(resolveRateLimitTier("/api/generate-adaptive")).toBe("attack");
  });

  it("maps other API routes to api tier", () => {
    expect(resolveRateLimitTier("/api/models")).toBe("api");
    expect(resolveRateLimitTier("/api/test-connection")).toBe("api");
    expect(resolveRateLimitTier("/api/explain")).toBe("api");
    expect(resolveRateLimitTier("/api/generate-payload")).toBe("api");
  });

  it("returns null for non-API routes", () => {
    expect(resolveRateLimitTier("/")).toBeNull();
    expect(resolveRateLimitTier("/login")).toBeNull();
    expect(resolveRateLimitTier("/dashboard")).toBeNull();
  });
});

describe("rateLimiter", () => {
  beforeEach(() => {
    rateLimiter.reset();
  });

  it("allows requests under the limit", () => {
    const result = rateLimiter.check("client-1", "api");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(RATE_LIMIT_TIERS.api.maxRequests);
    // remaining = max - currentCount - 1 (for this request)
    expect(result.remaining).toBe(RATE_LIMIT_TIERS.api.maxRequests - 1);
  });

  it("blocks requests over the limit", () => {
    const tier = "auth"; // 5 req / 60s
    const max = RATE_LIMIT_TIERS.auth.maxRequests;

    // Use up all requests
    for (let i = 0; i < max; i++) {
      const r = rateLimiter.check("brute-forcer", tier);
      expect(r.allowed).toBe(true);
    }

    // Next request should be blocked
    const blocked = rateLimiter.check("brute-forcer", tier);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetSeconds).toBeGreaterThan(0);
  });

  it("tracks clients independently", () => {
    const tier = "auth";
    const max = RATE_LIMIT_TIERS.auth.maxRequests;

    // Exhaust client A
    for (let i = 0; i < max; i++) {
      rateLimiter.check("client-A", tier);
    }

    // Client B should still be allowed
    const resultB = rateLimiter.check("client-B", tier);
    expect(resultB.allowed).toBe(true);
  });

  it("tracks tiers independently per client", () => {
    const authMax = RATE_LIMIT_TIERS.auth.maxRequests;

    // Exhaust auth tier for client
    for (let i = 0; i < authMax; i++) {
      rateLimiter.check("client-1", "auth");
    }
    const authBlocked = rateLimiter.check("client-1", "auth");
    expect(authBlocked.allowed).toBe(false);

    // Same client should still be allowed on api tier
    const apiAllowed = rateLimiter.check("client-1", "api");
    expect(apiAllowed.allowed).toBe(true);
  });

  it("resets window after time passes", () => {
    const tier = "auth";
    const max = RATE_LIMIT_TIERS.auth.maxRequests;

    // Exhaust limit
    for (let i = 0; i < max; i++) {
      rateLimiter.check("client-1", tier);
    }
    expect(rateLimiter.check("client-1", tier).allowed).toBe(false);

    // Fast-forward past the window
    vi.useFakeTimers();
    vi.advanceTimersByTime(RATE_LIMIT_TIERS.auth.windowSeconds * 1000 + 100);

    // Should be allowed again
    const result = rateLimiter.check("client-1", tier);
    expect(result.allowed).toBe(true);

    vi.useRealTimers();
  });

  it("reports client count", () => {
    rateLimiter.check("a", "api");
    rateLimiter.check("b", "api");
    rateLimiter.check("c", "auth");
    // "a" and "b" each have api tier, "c" has auth tier = 3 entries
    expect(rateLimiter.clientCount).toBe(3);
  });
});

describe("getClientKey", () => {
  it("extracts from X-Forwarded-For", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "X-Forwarded-For": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientKey(req)).toBe("1.2.3.4");
  });

  it("extracts from X-Real-IP", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "X-Real-IP": "10.0.0.1" },
    });
    expect(getClientKey(req)).toBe("10.0.0.1");
  });

  it("falls back to direct", () => {
    const req = new Request("http://localhost/api/test");
    expect(getClientKey(req)).toBe("direct");
  });

  it("prefers X-Forwarded-For over X-Real-IP", () => {
    const req = new Request("http://localhost/api/test", {
      headers: {
        "X-Forwarded-For": "1.2.3.4",
        "X-Real-IP": "10.0.0.1",
      },
    });
    expect(getClientKey(req)).toBe("1.2.3.4");
  });
});

describe("rateLimitHeaders", () => {
  it("generates correct headers", () => {
    const headers = rateLimitHeaders({
      limit: 30,
      remaining: 25,
      resetSeconds: 45,
    });

    expect(headers["X-RateLimit-Limit"]).toBe("30");
    expect(headers["X-RateLimit-Remaining"]).toBe("25");
    expect(headers["X-RateLimit-Reset"]).toBe("45");
    expect(headers["Retry-After"]).toBe("45");
  });
});
