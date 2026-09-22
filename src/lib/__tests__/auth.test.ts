import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to set env vars BEFORE importing the module
const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.PINCER_USERNAME;
  delete process.env.PINCER_PASSWORD;
  delete process.env.PINCER_AUTH_DISABLED;
  delete process.env.PINCER_SESSION_SECRET;
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
      process.env.PINCER_USERNAME = "admin";
      process.env.PINCER_PASSWORD = "secret";
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(true);
    });

    it("returns false when only username is set", async () => {
      process.env.PINCER_USERNAME = "admin";
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(false);
    });

    it("returns false when PINCER_AUTH_DISABLED is true", async () => {
      process.env.PINCER_USERNAME = "admin";
      process.env.PINCER_PASSWORD = "secret";
      process.env.PINCER_AUTH_DISABLED = "true";
      const { isAuthEnabled } = await import("../auth");
      expect(isAuthEnabled()).toBe(false);
    });
  });

  describe("validateCredentials", () => {
    it("returns true for matching credentials", async () => {
      process.env.PINCER_USERNAME = "admin";
      process.env.PINCER_PASSWORD = "secret123";
      const { validateCredentials } = await import("../auth");
      expect(validateCredentials("admin", "secret123")).toBe(true);
    });

    it("returns false for wrong password", async () => {
      process.env.PINCER_USERNAME = "admin";
      process.env.PINCER_PASSWORD = "secret123";
      const { validateCredentials } = await import("../auth");
      expect(validateCredentials("admin", "wrong")).toBe(false);
    });

    it("returns false for wrong username", async () => {
      process.env.PINCER_USERNAME = "admin";
      process.env.PINCER_PASSWORD = "secret123";
      const { validateCredentials } = await import("../auth");
      expect(validateCredentials("wrong", "secret123")).toBe(false);
    });
  });

  describe("session tokens", () => {
    it("creates and validates a session token", async () => {
      process.env.PINCER_PASSWORD = "test-secret";
      const { createSessionToken, validateSessionToken } = await import("../auth");
      const token = createSessionToken("testuser");
      const result = validateSessionToken(token);
      expect(result.valid).toBe(true);
      expect(result.username).toBe("testuser");
    });

    it("rejects tampered tokens", async () => {
      process.env.PINCER_PASSWORD = "test-secret";
      const { createSessionToken, validateSessionToken } = await import("../auth");
      const token = createSessionToken("testuser");
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = validateSessionToken(tampered);
      expect(result.valid).toBe(false);
    });

    it("rejects malformed tokens", async () => {
      const { validateSessionToken } = await import("../auth");
      expect(validateSessionToken("").valid).toBe(false);
      expect(validateSessionToken("not.a.valid.token").valid).toBe(false);
      expect(validateSessionToken("garbage").valid).toBe(false);
    });
  });
});
