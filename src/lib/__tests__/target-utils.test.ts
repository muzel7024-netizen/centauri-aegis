import { describe, it, expect } from "vitest";
import { getTargetKeyFields, getConfigRequestFields, targetHasKey, getKeyDisplayLabel } from "../target-utils";
import type { TargetConfig } from "../types";

function makeTarget(overrides: Partial<TargetConfig> = {}): TargetConfig {
  return {
    id: "t-1",
    name: "Test Target",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4",
    provider: "openai",
    connected: false,
    ...overrides,
  };
}

describe("getTargetKeyFields", () => {
  it("returns apiKeyId when present", () => {
    const target = makeTarget({ apiKeyId: "kid-123" });
    expect(getTargetKeyFields(target)).toEqual({ apiKeyId: "kid-123" });
  });

  it("prefers apiKey over apiKeyId when both are present", () => {
    const target = makeTarget({ apiKeyId: "kid-123", apiKey: "sk-legacy" });
    const result = getTargetKeyFields(target);
    expect(result).toEqual({ apiKey: "sk-legacy" });
    expect(result).not.toHaveProperty("apiKeyId");
  });

  it("falls back to apiKey when no apiKeyId", () => {
    const target = makeTarget({ apiKey: "sk-legacy" });
    expect(getTargetKeyFields(target)).toEqual({ apiKey: "sk-legacy" });
  });

  it("returns empty object when no key at all", () => {
    const target = makeTarget();
    expect(getTargetKeyFields(target)).toEqual({});
  });
});

describe("getConfigRequestFields", () => {
  it("includes endpoint, model, provider, and key fields", () => {
    const target = makeTarget({ apiKeyId: "kid-1" });
    const result = getConfigRequestFields(target);
    expect(result).toEqual({
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4",
      provider: "openai",
      apiKeyId: "kid-1",
    });
  });

  it("works with legacy apiKey", () => {
    const target = makeTarget({ apiKey: "sk-test" });
    const result = getConfigRequestFields(target);
    expect(result.apiKey).toBe("sk-test");
    expect(result.endpoint).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("works with no key", () => {
    const target = makeTarget();
    const result = getConfigRequestFields(target);
    expect(result).not.toHaveProperty("apiKey");
    expect(result).not.toHaveProperty("apiKeyId");
  });

  it("uses correct provider", () => {
    const target = makeTarget({ provider: "anthropic", endpoint: "https://api.anthropic.com/v1/messages" });
    expect(getConfigRequestFields(target).provider).toBe("anthropic");
    expect(getConfigRequestFields(target).endpoint).toBe("https://api.anthropic.com/v1/messages");
  });
});

describe("targetHasKey", () => {
  it("returns true with apiKeyId", () => {
    expect(targetHasKey(makeTarget({ apiKeyId: "kid-1" }))).toBe(true);
  });

  it("returns true with apiKey", () => {
    expect(targetHasKey(makeTarget({ apiKey: "sk-test" }))).toBe(true);
  });

  it("returns true with both", () => {
    expect(targetHasKey(makeTarget({ apiKeyId: "kid-1", apiKey: "sk-test" }))).toBe(true);
  });

  it("returns false with neither", () => {
    expect(targetHasKey(makeTarget())).toBe(false);
  });

  it("returns false with empty string apiKey", () => {
    expect(targetHasKey(makeTarget({ apiKey: "" }))).toBe(false);
  });
});

describe("getKeyDisplayLabel", () => {
  it("returns apiKeyLabel when present", () => {
    const target = makeTarget({ apiKeyLabel: "sk-...abc" });
    expect(getKeyDisplayLabel(target)).toBe("sk-...abc");
  });

  it("masks apiKey showing first 4 and last 4 chars", () => {
    const target = makeTarget({ apiKey: "sk-1234567890abcdef" });
    expect(getKeyDisplayLabel(target)).toBe("sk-1...cdef");
  });

  it("returns dots for short apiKey (8 chars or fewer)", () => {
    const target = makeTarget({ apiKey: "sk-short" });
    expect(getKeyDisplayLabel(target)).toBe("••••••••");
  });

  it("returns dots for very short apiKey", () => {
    const target = makeTarget({ apiKey: "abc" });
    expect(getKeyDisplayLabel(target)).toBe("••••••••");
  });

  it("returns 'No key' when no key info", () => {
    expect(getKeyDisplayLabel(makeTarget())).toBe("No key");
  });

  it("prefers apiKeyLabel over apiKey masking", () => {
    const target = makeTarget({ apiKeyLabel: "custom-label", apiKey: "sk-should-not-be-used" });
    expect(getKeyDisplayLabel(target)).toBe("custom-label");
  });
});
