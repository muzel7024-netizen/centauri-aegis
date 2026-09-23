/**
 * Server-side encrypted API key vault.
 *
 * API keys are encrypted with AES-256-GCM using a secret derived from
 * PINCER_KEY_SECRET (or PINCER_SESSION_SECRET / PINCER_PASSWORD as fallback).
 * Keys are stored in-memory on the server — they never reach localStorage.
 *
 * Each key gets an opaque ID (e.g., "key_abc123") stored client-side instead
 * of the plaintext key. API routes resolve keyId → actual key server-side.
 *
 * On server restart, the vault is empty — users re-enter keys once.
 * This is acceptable for a security testing tool where sessions are short-lived.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

// ── Types ───────────────────────────────────────────────────────────────

interface VaultEntry {
  encrypted: Buffer;   // AES-256-GCM ciphertext
  iv: Buffer;          // 12 bytes
  tag: Buffer;         // 16 bytes auth tag
  label: string;       // display label (e.g., "sk-...abc")
  createdAt: number;
}

// ── Vault singleton ─────────────────────────────────────────────────────

const vault = new Map<string, VaultEntry>();

// ── Key derivation ──────────────────────────────────────────────────────

let ephemeralVaultKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.AEGIS_KEY_SECRET ||
    process.env.AEGIS_SESSION_SECRET ||
    process.env.AEGIS_PASSWORD ||
    process.env.PINCER_KEY_SECRET || // Legacy compatibility only — do not use for new deployments.
    process.env.PINCER_SESSION_SECRET || // Legacy compatibility only
    process.env.PINCER_PASSWORD; // Legacy compatibility only

  if (secret) {
    return createHash("sha256").update(secret).digest();
  }

  // If no secret is configured, generate a process-bound ephemeral 256-bit random key
  if (!ephemeralVaultKey) {
    ephemeralVaultKey = randomBytes(32);
    if (process.env.NODE_ENV !== "test") {
      console.info("[Centauri Aegis] Notice: No AEGIS_KEY_SECRET set; using secure ephemeral in-memory vault key for this process.");
    }
  }

  return ephemeralVaultKey;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function generateKeyId(): string {
  return `key_${randomBytes(12).toString("hex")}`;
}

function maskKey(apiKey: string): string {
  if (apiKey.length <= 8) return "••••••••";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

// ── Encrypt / Decrypt ───────────────────────────────────────────────────

function encrypt(plaintext: string): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return { encrypted, iv, tag };
}

function decrypt(entry: VaultEntry): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, entry.iv);
  decipher.setAuthTag(entry.tag);

  const decrypted = Buffer.concat([
    decipher.update(entry.encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Store an API key in the vault. Returns an opaque key ID.
 */
export function storeKey(apiKey: string): { keyId: string; label: string } {
  const keyId = generateKeyId();
  const label = maskKey(apiKey);
  const { encrypted, iv, tag } = encrypt(apiKey);

  vault.set(keyId, {
    encrypted,
    iv,
    tag,
    label,
    createdAt: Date.now(),
  });

  return { keyId, label };
}

/**
 * Retrieve the plaintext API key for a given key ID.
 * Returns null if the key ID is not found (e.g., after server restart).
 */
export function retrieveKey(keyId: string): string | null {
  const entry = vault.get(keyId);
  if (!entry) return null;

  try {
    return decrypt(entry);
  } catch {
    // Decryption failed — corrupt entry or secret changed
    vault.delete(keyId);
    return null;
  }
}

/**
 * Get the masked label for a key ID (for display).
 */
export function getKeyLabel(keyId: string): string | null {
  const entry = vault.get(keyId);
  return entry?.label ?? null;
}

/**
 * Delete a key from the vault.
 */
export function deleteKey(keyId: string): boolean {
  return vault.delete(keyId);
}

/**
 * Check if a key ID exists in the vault.
 */
export function hasKey(keyId: string): boolean {
  return vault.has(keyId);
}

/**
 * Resolve an API key from either a keyId or a raw apiKey string.
 * - If apiKeyId is provided and valid, returns the decrypted key
 * - If apiKey is provided directly (backward compat), returns it as-is
 * - Returns null if neither is available
 */
export function resolveApiKey(params: {
  apiKeyId?: string;
  apiKey?: string;
}): string | null {
  if (params.apiKeyId) {
    return retrieveKey(params.apiKeyId);
  }
  if (params.apiKey) {
    return params.apiKey;
  }
  return null;
}

/**
 * Get vault stats (for debugging).
 */
export function getVaultStats(): { count: number; keyIds: string[] } {
  return {
    count: vault.size,
    keyIds: Array.from(vault.keys()),
  };
}
