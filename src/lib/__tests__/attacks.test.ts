import { describe, it, expect } from "vitest";
import {
  allPayloads,
  getPayloadsByCategory,
  getPayloadById,
  getAllTags,
} from "../attacks/index";
import type { AttackCategory } from "../types";

describe("attack payloads", () => {
  it("has payloads loaded", () => {
    expect(allPayloads.length).toBeGreaterThan(100);
  });

  it("every payload has required fields", () => {
    for (const payload of allPayloads) {
      expect(payload.id).toBeTruthy();
      expect(payload.name).toBeTruthy();
      expect(payload.category).toBeTruthy();
      expect(payload.severity).toBeTruthy();
      expect(payload.prompt).toBeTruthy();
    }
  });

  it("all payload ids are unique", () => {
    const ids = new Set(allPayloads.map((p) => p.id));
    expect(ids.size).toBe(allPayloads.length);
  });

  it("all payloads have valid categories", () => {
    const validCategories: AttackCategory[] = [
      "injection", "jailbreak", "extraction", "bypass",
      "tool_abuse", "multi_turn", "encoding",
    ];
    for (const payload of allPayloads) {
      expect(validCategories).toContain(payload.category);
    }
  });

  it("all payloads have valid severity", () => {
    const validSeverities = ["critical", "high", "medium", "low"];
    for (const payload of allPayloads) {
      expect(validSeverities).toContain(payload.severity);
    }
  });
});

describe("getPayloadsByCategory", () => {
  it("returns only injection payloads", () => {
    const results = getPayloadsByCategory("injection");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.category === "injection")).toBe(true);
  });

  it("returns only jailbreak payloads", () => {
    const results = getPayloadsByCategory("jailbreak");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.category === "jailbreak")).toBe(true);
  });

  it("returns empty for invalid category", () => {
    // @ts-expect-error testing invalid input
    const results = getPayloadsByCategory("nonexistent");
    expect(results.length).toBe(0);
  });
});

describe("getPayloadById", () => {
  it("finds existing payload", () => {
    const payload = getPayloadById("inj-001");
    expect(payload).toBeDefined();
    expect(payload?.category).toBe("injection");
  });

  it("returns undefined for nonexistent id", () => {
    expect(getPayloadById("xxx-999")).toBeUndefined();
  });
});

describe("getAllTags", () => {
  it("returns non-empty tag list", () => {
    const tags = getAllTags();
    expect(tags.length).toBeGreaterThan(0);
  });

  it("returns unique tags", () => {
    const tags = getAllTags();
    expect(new Set(tags).size).toBe(tags.length);
  });
});
