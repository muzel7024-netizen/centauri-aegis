/**
 * Authentication utilities for Centauri Aegis.
 *
 * Auth is enabled when AEGIS_USERNAME and AEGIS_PASSWORD env vars are set.
 * Set AEGIS_AUTH_DISABLED=true to explicitly disable auth even if credentials exist.
 *
 * Session tokens are HMAC-signed (SHA-256) cookies with a configurable TTL,
 * implemented via the Web Crypto API for universal compatibility across Node.js,
 * Next.js Edge Middleware, and browser environments.
 */

// ── Config ──────────────────────────────────────────────────────────────

const SESSION_COOKIE = "aegis_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let ephemeralSessionSecret: string | null = null;

function randomHex(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getSecret(): string {
  const secret =
    process.env.AEGIS_SESSION_SECRET ||
    process.env.AEGIS_PASSWORD;

  if (secret) return secret;

  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = randomHex(32);
  }
  return ephemeralSessionSecret;
}

// ── Web Crypto Encoding & HMAC ──────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
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

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function validateCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.AEGIS_USERNAME || "";
  const expectedPass = process.env.AEGIS_PASSWORD || "";

  if (!expectedUser || !expectedPass) return false;

  return (
    constantTimeEqual(username, expectedUser) &&
    constantTimeEqual(password, expectedPass)
  );
}

// ── Session tokens ──────────────────────────────────────────────────────

interface SessionPayload {
  sub: string; // username
  iat: number; // issued at (ms)
  exp: number; // expires at (ms)
  jti: string; // unique ID
}

async function sign(payload: SessionPayload): Promise<string> {
  const enc = new TextEncoder();
  const data = JSON.stringify(payload);
  const b64 = base64UrlEncode(enc.encode(data));
  const key = await getHmacKey(getSecret());
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(b64));
  const sig = base64UrlEncode(sigBuffer);
  return `${b64}.${sig}`;
}

async function verify(token: string): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [b64, sig] = parts;
  const enc = new TextEncoder();

  try {
    const key = await getHmacKey(getSecret());
    const sigBytes = base64UrlDecode(sig);
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, enc.encode(b64));
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(b64));
    const payload: SessionPayload = JSON.parse(payloadJson);
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionToken(username: string): Promise<string> {
  const now = Date.now();
  return await sign({
    sub: username,
    iat: now,
    exp: now + SESSION_TTL_MS,
    jti: randomHex(16),
  });
}

export async function validateSessionToken(token: string): Promise<{ valid: boolean; username?: string }> {
  const payload = await verify(token);
  if (!payload) return { valid: false };
  return { valid: true, username: payload.sub };
}

export interface RequestAuthResult {
  authenticated: boolean;
  username?: string;
  error?: string;
}

/**
 * Validates request authentication authoritatively.
 * 1. Checks if auth is enabled (via isAuthEnabled()). If disabled, allows request.
 * 2. Extracts the `aegis_session` cookie from request cookies or Cookie header.
 * 3. Cryptographically validates the HMAC-SHA256 signature and expiration via Web Crypto.
 * 4. Rejects missing, malformed, expired, or forged tokens.
 */
export async function validateRequestAuth(
  request: Request | { cookies?: { get(name: string): { value: string } | undefined }; headers?: Headers }
): Promise<RequestAuthResult> {
  if (!isAuthEnabled()) {
    return { authenticated: true };
  }

  let token: string | undefined;

  if ("cookies" in request && request.cookies && typeof request.cookies.get === "function") {
    token = request.cookies.get(SESSION_COOKIE)?.value;
  }

  if (!token && "headers" in request && request.headers) {
    const cookieHeader =
      typeof request.headers.get === "function"
        ? request.headers.get("cookie")
        : (request.headers as unknown as Record<string, string>)["cookie"];
    if (cookieHeader) {
      const match = cookieHeader.match(
        new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`)
      );
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }

  if (!token) {
    return { authenticated: false, error: "Authentication required" };
  }

  const session = await validateSessionToken(token);
  if (!session.valid) {
    return { authenticated: false, error: "Invalid or expired session" };
  }

  return { authenticated: true, username: session.username };
}

export { SESSION_COOKIE };
