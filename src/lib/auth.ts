/**
 * Authentication utilities for Centauri Aegis.
 *
 * Auth is enabled when AEGIS_USERNAME and AEGIS_PASSWORD env vars are set.
 * Set AEGIS_AUTH_DISABLED=true to explicitly disable auth even if credentials exist.
 *
 * Session tokens are HMAC-signed (SHA-256) cookies with a configurable TTL.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// ── Config ──────────────────────────────────────────────────────────────

const SESSION_COOKIE = "aegis_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let ephemeralSessionSecret: string | null = null;

function getSecret(): string {
  const secret =
    process.env.AEGIS_SESSION_SECRET ||
    process.env.AEGIS_PASSWORD;

  if (secret) return secret;

  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = randomBytes(32).toString("hex");
  }
  return ephemeralSessionSecret;
}

// ── Public helpers ──────────────────────────────────────────────────────

export function isAuthEnabled(): boolean {
  if (process.env.AEGIS_AUTH_DISABLED === "true") {
    return false;
  }
  const user = process.env.AEGIS_USERNAME;
  const pass = process.env.AEGIS_PASSWORD;
  return !!(user && pass);
}

export function validateCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.AEGIS_USERNAME || "";
  const expectedPass = process.env.AEGIS_PASSWORD || "";

  // Constant-time comparison to prevent timing attacks
  const userBuf = Buffer.from(username);
  const passBuf = Buffer.from(password);
  const expectedUserBuf = Buffer.from(expectedUser);
  const expectedPassBuf = Buffer.from(expectedPass);

  const userMatch =
    userBuf.length === expectedUserBuf.length &&
    timingSafeEqual(userBuf, expectedUserBuf);
  const passMatch =
    passBuf.length === expectedPassBuf.length &&
    timingSafeEqual(passBuf, expectedPassBuf);

  return userMatch && passMatch;
}

// ── Session tokens ──────────────────────────────────────────────────────

interface SessionPayload {
  sub: string; // username
  iat: number; // issued at (ms)
  exp: number; // expires at (ms)
  jti: string; // unique ID
}

function sign(payload: SessionPayload): string {
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [b64, sig] = parts;
  const expectedSig = createHmac("sha256", getSecret()).update(b64).digest("base64url");

  // Constant-time comparison
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload: SessionPayload = JSON.parse(
      Buffer.from(b64, "base64url").toString()
    );
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(username: string): string {
  const now = Date.now();
  return sign({
    sub: username,
    iat: now,
    exp: now + SESSION_TTL_MS,
    jti: randomBytes(16).toString("hex"),
  });
}

export function validateSessionToken(token: string): { valid: boolean; username?: string } {
  const payload = verify(token);
  if (!payload) return { valid: false };
  return { valid: true, username: payload.sub };
}

export { SESSION_COOKIE };
