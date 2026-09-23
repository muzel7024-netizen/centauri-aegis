import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to set env vars BEFORE importing the module
const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.AEGIS_USERNAME;
  delete process.env.AEGIS_PASSWORD;
  delete process.env.AEGIS_AUTH_DISABLED;
  delete process.env.AEGIS_SESSION_SECRET;
}

describe("auth", () => {
  beforeEach(() => {
    resetEnv();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isAuthEnabled", () => {
    it("returns false when no credentials are set", async () => {
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(false);
    });

    it("returns true when both username and password are set", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secret";
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(true);
    });

    it("returns false when only username is set", async () => {
      process.env.AEGIS_USERNAME = "admin";
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(false);
    });

    it("returns false when AEGIS_AUTH_DISABLED is true", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secret";
      process.env.AEGIS_AUTH_DISABLED = "true";
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(false);
    });
  });

  describe("validateCredentials", () => {
    it("returns true for matching credentials", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secret123";
      const { validateCredentials } = await import("../auth");
      expect(validateCredentials("admin", "secret123")).toBe(true);
    });

    it("returns false for wrong password", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secret123";
      const { validateCredentials } = await import("../auth");
      expect(validateCredentials("admin", "wrong")).toBe(false);
    });

    it("returns false for wrong username", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secret123";
      const { validateCredentials } = await import("../auth");
      expect(validateCredentials("wrong", "secret123")).toBe(false);
    });
  });

  describe("session tokens", () => {
    it("creates and validates a session token", async () => {
      process.env.AEGIS_PASSWORD = "test-secret";
      const { createSessionToken, validateSessionToken } = await import("../auth");
      const token = await createSessionToken("testuser");
      const result = await validateSessionToken(token);
      expect(result.valid).toBe(true);
      expect(result.username).toBe("testuser");
    });

    it("rejects tampered tokens", async () => {
      process.env.AEGIS_PASSWORD = "test-secret";
      const { createSessionToken, validateSessionToken } = await import("../auth");
      const token = await createSessionToken("testuser");
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = await validateSessionToken(tampered);
      expect(result.valid).toBe(false);
    });

    it("rejects malformed tokens", async () => {
      const { validateSessionToken } = await import("../auth");
      expect((await validateSessionToken("")).valid).toBe(false);
      expect((await validateSessionToken("not.a.valid.token")).valid).toBe(false);
      expect((await validateSessionToken("garbage")).valid).toBe(false);
    });

    it("rejects expired tokens", async () => {
      process.env.AEGIS_PASSWORD = "test-secret";
      const { createSessionToken, validateSessionToken } = await import("../auth");
      const token = await createSessionToken("testuser");
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 25 * 60 * 60 * 1000;
        expect((await validateSessionToken(token)).valid).toBe(false);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe("validateRequestAuth", () => {
    it("allows request when auth is disabled", async () => {
      const { validateRequestAuth } = await import("../auth");
      const req = new Request("http://localhost:3000/api/attack");
      const result = await validateRequestAuth(req);
      expect(result.authenticated).toBe(true);
    });

    it("rejects request when auth is enabled and session cookie is missing", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { validateRequestAuth } = await import("../auth");
      const req = new Request("http://localhost:3000/api/attack");
      const result = await validateRequestAuth(req);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Authentication required");
    });

    it("allows request with valid session cookie via Cookie header", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { createSessionToken, validateRequestAuth } = await import("../auth");
      const token = await createSessionToken("admin");
      const req = new Request("http://localhost:3000/api/attack", {
        headers: { Cookie: `aegis_session=${token}` },
      });
      const result = await validateRequestAuth(req);
      expect(result.authenticated).toBe(true);
      expect(result.username).toBe("admin");
    });

    it("allows request with valid session cookie via request.cookies.get", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { createSessionToken, validateRequestAuth } = await import("../auth");
      const token = await createSessionToken("admin");
      const mockRequest = {
        cookies: {
          get: (name: string) => (name === "aegis_session" ? { value: token } : undefined),
        },
      };
      const result = await validateRequestAuth(mockRequest as unknown as Request);
      expect(result.authenticated).toBe(true);
      expect(result.username).toBe("admin");
    });

    it("rejects forged session cookie", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { validateRequestAuth } = await import("../auth");
      const req = new Request("http://localhost:3000/api/attack", {
        headers: { Cookie: "aegis_session=spoofed_cookie_value" },
      });
      const result = await validateRequestAuth(req);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Invalid or expired session");
    });

    it("rejects malformed session cookie", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { validateRequestAuth } = await import("../auth");
      const req = new Request("http://localhost:3000/api/keys", {
        headers: { Cookie: "aegis_session=invalid.token.payload" },
      });
      const result = await validateRequestAuth(req);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBe("Invalid or expired session");
    });

    it("rejects expired session in request", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { createSessionToken, validateRequestAuth } = await import("../auth");
      const token = await createSessionToken("admin");
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 30 * 60 * 60 * 1000;
        const req = new Request("http://localhost:3000/api/chain", {
          headers: { Cookie: `aegis_session=${token}` },
        });
        const result = await validateRequestAuth(req);
        expect(result.authenticated).toBe(false);
        expect(result.error).toBe("Invalid or expired session");
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe("middleware authentication enforcement", () => {
    it("blocks forged aegis_session cookie with 401 on /api/attack", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { middleware } = await import("../../middleware");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/attack", {
        method: "POST",
        headers: {
          Cookie: "aegis_session=forged_token_attempt",
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Invalid or expired session");
    });

    it("blocks missing session cookie with 401 on /api/keys", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { middleware } = await import("../../middleware");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/keys", {
        method: "POST",
      });

      const res = await middleware(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Authentication required");
    });

    it("redirects forged session on page routes to /login", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { middleware } = await import("../../middleware");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/assessments", {
        headers: {
          Cookie: "aegis_session=forged_token_attempt",
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login?redirect=");
    });

    it("permits valid session on /api/attack through middleware", async () => {
      process.env.AEGIS_USERNAME = "admin";
      process.env.AEGIS_PASSWORD = "secretPassword123";
      const { createSessionToken } = await import("../auth");
      const { middleware } = await import("../../middleware");
      const { NextRequest } = await import("next/server");

      const validToken = await createSessionToken("admin");
      const req = new NextRequest("http://localhost:3000/api/attack", {
        method: "POST",
        headers: {
          Cookie: `aegis_session=${validToken}`,
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.has("X-RateLimit-Limit")).toBe(true);
    });
  });
});
