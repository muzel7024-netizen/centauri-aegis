/**
 * @vitest-environment node
 *
 * Tests for the server-side encrypted API key vault (AES-256-GCM).
 * Uses real Node crypto — no mocking needed.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  storeKey,
  retrieveKey,
  getKeyLabel,
  deleteKey,
  hasKey,
  resolveApiKey,
  getVaultStats,
} from "../key-vault";

// Clean the vault between tests using the public API
beforeEach(() => {
  const { keyIds } = getVaultStats();
  for (const id of keyIds) deleteKey(id);
});

describe("key-vault", () => {
  // ── storeKey ────────────────────────────────────────────────────────

  describe("storeKey", () => {
    it("returns a keyId starting with 'key_'", () => {
      const { keyId } = storeKey("sk-test-api-key-12345678");
      expect(keyId).toMatch(/^key_[0-9a-f]{24}$/);
    });

    it("returns a masked label for long keys", () => {
      const { label } = storeKey("sk-test-api-key-12345678");
      expect(label).toBe("sk-t...5678");
    });

    it("returns masked label for short keys (≤8 chars)", () => {
      const { label } = storeKey("short");
      expect(label).toBe("••••••••");
    });

    it("returns masked label for exactly 8-char key", () => {
      const { label } = storeKey("12345678");
      expect(label).toBe("••••••••");
    });

    it("returns masked label for 9-char key", () => {
      const { label } = storeKey("123456789");
      expect(label).toBe("1234...6789");
    });

    it("generates unique keyIds for different keys", () => {
      const { keyId: id1 } = storeKey("sk-key-one-aaaa");
      const { keyId: id2 } = storeKey("sk-key-two-bbbb");
      expect(id1).not.toBe(id2);
    });

    it("generates unique keyIds even for the same key stored twice", () => {
      const { keyId: id1 } = storeKey("sk-same-key-1234");
      const { keyId: id2 } = storeKey("sk-same-key-1234");
      expect(id1).not.toBe(id2);
    });
  });

  // ── retrieveKey ─────────────────────────────────────────────────────

  describe("retrieveKey", () => {
    it("round-trips: store → retrieve returns original key", () => {
      const apiKey = "sk-test-round-trip-key-99";
      const { keyId } = storeKey(apiKey);
      const retrieved = retrieveKey(keyId);
      expect(retrieved).toBe(apiKey);
    });

    it("returns null for non-existent keyId", () => {
      expect(retrieveKey("key_nonexistent")).toBeNull();
    });

    it("returns null for empty string keyId", () => {
      expect(retrieveKey("")).toBeNull();
    });

    it("round-trips keys with special characters", () => {
      const specialKey = "sk-tëst/key+with=special&chars!@#$%";
      const { keyId } = storeKey(specialKey);
      expect(retrieveKey(keyId)).toBe(specialKey);
    });

    it("round-trips very long keys", () => {
      const longKey = "sk-" + "a".repeat(500);
      const { keyId } = storeKey(longKey);
      expect(retrieveKey(keyId)).toBe(longKey);
    });

    it("round-trips empty string key", () => {
      const { keyId } = storeKey("");
      expect(retrieveKey(keyId)).toBe("");
    });
  });

  // ── getKeyLabel ─────────────────────────────────────────────────────

  describe("getKeyLabel", () => {
    it("returns the masked label for a stored key", () => {
      const { keyId } = storeKey("sk-label-test-abcdef");
      expect(getKeyLabel(keyId)).toBe("sk-l...cdef");
    });

    it("returns null for non-existent keyId", () => {
      expect(getKeyLabel("key_doesnotexist")).toBeNull();
    });
  });

  // ── deleteKey ───────────────────────────────────────────────────────

  describe("deleteKey", () => {
    it("returns true when deleting an existing key", () => {
      const { keyId } = storeKey("sk-delete-me-1234");
      expect(deleteKey(keyId)).toBe(true);
    });

    it("returns false when deleting a non-existent key", () => {
      expect(deleteKey("key_ghost")).toBe(false);
    });

    it("makes the key unretrievable after deletion", () => {
      const { keyId } = storeKey("sk-gone-forever-5678");
      deleteKey(keyId);
      expect(retrieveKey(keyId)).toBeNull();
      expect(hasKey(keyId)).toBe(false);
      expect(getKeyLabel(keyId)).toBeNull();
    });
  });

  // ── hasKey ──────────────────────────────────────────────────────────

  describe("hasKey", () => {
    it("returns true for a stored key", () => {
      const { keyId } = storeKey("sk-check-exists-9876");
      expect(hasKey(keyId)).toBe(true);
    });

    it("returns false for a non-existent key", () => {
      expect(hasKey("key_nope")).toBe(false);
    });

    it("returns false after key is deleted", () => {
      const { keyId } = storeKey("sk-temp-key-5555");
      deleteKey(keyId);
      expect(hasKey(keyId)).toBe(false);
    });
  });

  // ── resolveApiKey ───────────────────────────────────────────────────

  describe("resolveApiKey", () => {
    it("resolves via apiKeyId when vault has the key", () => {
      const { keyId } = storeKey("sk-vault-key-resolve");
      const resolved = resolveApiKey({ apiKeyId: keyId });
      expect(resolved).toBe("sk-vault-key-resolve");
    });

    it("returns null when apiKeyId is not in vault", () => {
      expect(resolveApiKey({ apiKeyId: "key_missing" })).toBeNull();
    });

    it("falls back to raw apiKey when provided (backward compat)", () => {
      const resolved = resolveApiKey({ apiKey: "sk-raw-key-fallback" });
      expect(resolved).toBe("sk-raw-key-fallback");
    });

    it("prefers apiKeyId over raw apiKey when both provided", () => {
      const { keyId } = storeKey("sk-vault-preferred");
      const resolved = resolveApiKey({
        apiKeyId: keyId,
        apiKey: "sk-raw-ignored",
      });
      expect(resolved).toBe("sk-vault-preferred");
    });

    it("returns null when neither apiKeyId nor apiKey provided", () => {
      expect(resolveApiKey({})).toBeNull();
    });

    it("returns null when apiKeyId is empty string", () => {
      expect(resolveApiKey({ apiKeyId: "" })).toBeNull();
    });

    it("returns raw apiKey when apiKeyId is empty but apiKey exists", () => {
      const resolved = resolveApiKey({ apiKeyId: "", apiKey: "sk-fallback-works" });
      expect(resolved).toBe("sk-fallback-works");
    });
  });

  // ── getVaultStats ───────────────────────────────────────────────────

  describe("getVaultStats", () => {
    it("returns 0 count for empty vault", () => {
      const stats = getVaultStats();
      expect(stats.count).toBe(0);
      expect(stats.keyIds).toEqual([]);
    });

    it("reflects stored keys", () => {
      const { keyId: id1 } = storeKey("sk-stats-one-aaaa");
      const { keyId: id2 } = storeKey("sk-stats-two-bbbb");
      const stats = getVaultStats();
      expect(stats.count).toBe(2);
      expect(stats.keyIds).toContain(id1);
      expect(stats.keyIds).toContain(id2);
    });

    it("reflects deletions", () => {
      const { keyId } = storeKey("sk-stats-delete-cccc");
      storeKey("sk-stats-keep-dddd");
      deleteKey(keyId);
      const stats = getVaultStats();
      expect(stats.count).toBe(1);
      expect(stats.keyIds).not.toContain(keyId);
    });
  });

  // ── Vault isolation ─────────────────────────────────────────────────

  describe("vault isolation", () => {
    it("vault is empty at start of each test (cleanup works)", () => {
      expect(getVaultStats().count).toBe(0);
    });

    it("multiple keys coexist without interference", () => {
      const keys = [
        "sk-multi-a-1111",
        "sk-multi-b-2222",
        "sk-multi-c-3333",
      ];
      const keyIds = keys.map((k) => storeKey(k).keyId);

      // Each key retrieves correctly
      for (let i = 0; i < keys.length; i++) {
        expect(retrieveKey(keyIds[i])).toBe(keys[i]);
      }

      // Delete middle one, others unaffected
      deleteKey(keyIds[1]);
      expect(retrieveKey(keyIds[0])).toBe(keys[0]);
      expect(retrieveKey(keyIds[1])).toBeNull();
      expect(retrieveKey(keyIds[2])).toBe(keys[2]);
    });
  });
});
