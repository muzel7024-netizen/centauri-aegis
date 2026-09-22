import { describe, it, expect } from "vitest";
import {
  analyzeWeaknesses,
  generateFollowUpStrategy,
} from "../adaptive";
import type {
  WeaknessProfile,
  CategoryWeakness,
  VulnerabilityPattern,
  FollowUpPlan,
} from "../adaptive";
import type { AttackResult, AttackCategory, Severity, AnalysisClassification } from "../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<AttackResult> & {
  category?: AttackCategory;
  severity?: Severity;
  classification?: AnalysisClassification;
  success?: boolean;
  severityScore?: number;
} = {}): AttackResult {
  return {
    id: overrides.id ?? `r-${Math.random().toString(36).slice(2, 8)}`,
    payloadId: overrides.payloadId ?? "test-payload",
    payloadName: overrides.payloadName ?? "Test Payload",
    category: overrides.category ?? "injection",
    severity: overrides.severity ?? "high",
    status: overrides.status ?? "success",
    prompt: overrides.prompt ?? "test prompt",
    response: overrides.response ?? "test response",
    timestamp: overrides.timestamp ?? Date.now(),
    durationMs: overrides.durationMs ?? 100,
    success: overrides.success ?? false,
    analysis: overrides.analysis ?? {
      classification: overrides.classification ?? "refusal",
      severityScore: overrides.severityScore ?? 1,
      confidence: 0.9,
      leakedData: [],
      reasoning: "Test",
      indicators: [],
    },
  };
}

// ── analyzeWeaknesses ────────────────────────────────────────────────────────

describe("analyzeWeaknesses", () => {
  it("returns empty profile for empty results", () => {
    const profile = analyzeWeaknesses([]);
    expect(profile.overallBreachRate).toBe(0);
    expect(profile.categoryWeaknesses).toHaveLength(0);
    expect(profile.vulnerabilityPatterns).toHaveLength(0);
    expect(profile.strongestCategory).toBeNull();
    expect(profile.weakestCategory).toBeNull();
    expect(profile.mostVulnerableSeverity).toBeNull();
  });

  it("calculates correct overall breach rate", () => {
    const results = [
      makeResult({ success: true }),
      makeResult({ success: true }),
      makeResult({ success: false }),
      makeResult({ success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    expect(profile.overallBreachRate).toBe(0.5);
  });

  it("calculates per-category weaknesses", () => {
    const results = [
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: false }),
      makeResult({ category: "jailbreak", success: true }),
      makeResult({ category: "jailbreak", success: true }),
    ];
    const profile = analyzeWeaknesses(results);
    expect(profile.categoryWeaknesses.length).toBe(2);

    const injection = profile.categoryWeaknesses.find((w) => w.category === "injection")!;
    expect(injection.successRate).toBe(0.5);
    expect(injection.totalAttempts).toBe(2);
    expect(injection.successCount).toBe(1);

    const jailbreak = profile.categoryWeaknesses.find((w) => w.category === "jailbreak")!;
    expect(jailbreak.successRate).toBe(1.0);
    expect(jailbreak.totalAttempts).toBe(2);
    expect(jailbreak.successCount).toBe(2);
  });

  it("identifies weakest and strongest categories", () => {
    const results = [
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "jailbreak", success: false }),
      makeResult({ category: "jailbreak", success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    expect(profile.weakestCategory).toBe("injection"); // highest success rate
    expect(profile.strongestCategory).toBe("jailbreak"); // lowest success rate
  });

  it("tracks severity breakdown per category", () => {
    const results = [
      makeResult({ category: "injection", severity: "critical", success: true }),
      makeResult({ category: "injection", severity: "critical", success: false }),
      makeResult({ category: "injection", severity: "high", success: true }),
    ];
    const profile = analyzeWeaknesses(results);
    const injection = profile.categoryWeaknesses.find((w) => w.category === "injection")!;
    expect(injection.severityBreakdown.critical.total).toBe(2);
    expect(injection.severityBreakdown.critical.breached).toBe(1);
    expect(injection.severityBreakdown.high.total).toBe(1);
    expect(injection.severityBreakdown.high.breached).toBe(1);
    expect(injection.severityBreakdown.medium.total).toBe(0);
    expect(injection.severityBreakdown.low.total).toBe(0);
  });

  it("identifies most vulnerable severity level", () => {
    const results = [
      makeResult({ severity: "critical", success: false }),
      makeResult({ severity: "critical", success: false }),
      makeResult({ severity: "low", success: true }),
      makeResult({ severity: "low", success: true }),
    ];
    const profile = analyzeWeaknesses(results);
    expect(profile.mostVulnerableSeverity).toBe("low");
  });

  it("extracts top techniques from successful attacks", () => {
    const results = [
      makeResult({ category: "injection", success: true, payloadName: "Payload A", severityScore: 9 }),
      makeResult({ category: "injection", success: true, payloadName: "Payload B", severityScore: 7 }),
      makeResult({ category: "injection", success: false, payloadName: "Payload C" }),
    ];
    const profile = analyzeWeaknesses(results);
    const injection = profile.categoryWeaknesses.find((w) => w.category === "injection")!;
    expect(injection.topTechniques).toContain("Payload A");
    expect(injection.topTechniques).toContain("Payload B");
    expect(injection.topTechniques).not.toContain("Payload C");
    // Sorted by severity score descending
    expect(injection.topTechniques[0]).toBe("Payload A");
  });

  it("detects full_jailbreak vulnerability pattern", () => {
    const results = [
      makeResult({ success: true, classification: "full_jailbreak" }),
      makeResult({ success: true, classification: "full_jailbreak" }),
      makeResult({ success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    const jbPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("full jailbreak"),
    );
    expect(jbPattern).toBeDefined();
    expect(jbPattern!.category).toBe("jailbreak");
    expect(jbPattern!.confidence).toBeGreaterThan(0.5);
  });

  it("detects information_leakage vulnerability pattern", () => {
    const results = [
      makeResult({ success: true, classification: "information_leakage", category: "extraction" }),
      makeResult({ success: true, classification: "information_leakage", category: "extraction" }),
    ];
    const profile = analyzeWeaknesses(results);
    const leakPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("leaks sensitive"),
    );
    expect(leakPattern).toBeDefined();
    expect(leakPattern!.category).toBe("extraction");
  });

  it("detects partial_compliance weakness pattern (3+ needed)", () => {
    const results = [
      makeResult({ success: true, classification: "partial_compliance" }),
      makeResult({ success: true, classification: "partial_compliance" }),
      makeResult({ success: true, classification: "partial_compliance" }),
    ];
    const profile = analyzeWeaknesses(results);
    const partialPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("partially complies"),
    );
    expect(partialPattern).toBeDefined();
    expect(partialPattern!.category).toBe("bypass");
  });

  it("does not flag partial_compliance with fewer than 3 results", () => {
    const results = [
      makeResult({ success: true, classification: "partial_compliance" }),
      makeResult({ success: true, classification: "partial_compliance" }),
    ];
    const profile = analyzeWeaknesses(results);
    const partialPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("partially complies"),
    );
    expect(partialPattern).toBeUndefined();
  });

  it("detects high category vulnerability pattern (>= 50% rate, >= 3 attempts)", () => {
    const results = [
      makeResult({ category: "bypass", success: true }),
      makeResult({ category: "bypass", success: true }),
      makeResult({ category: "bypass", success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    const catPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("Guardrail Bypass"),
    );
    expect(catPattern).toBeDefined();
    expect(catPattern!.category).toBe("bypass");
  });

  it("does not flag category with low success rate", () => {
    const results = [
      makeResult({ category: "bypass", success: false }),
      makeResult({ category: "bypass", success: false }),
      makeResult({ category: "bypass", success: false }),
      makeResult({ category: "bypass", success: true }),
    ];
    const profile = analyzeWeaknesses(results);
    const catPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("Guardrail Bypass"),
    );
    expect(catPattern).toBeUndefined();
  });

  it("handles single result without errors", () => {
    const results = [makeResult({ success: true, category: "jailbreak" })];
    const profile = analyzeWeaknesses(results);
    expect(profile.overallBreachRate).toBe(1.0);
    expect(profile.categoryWeaknesses).toHaveLength(1);
    expect(profile.weakestCategory).toBe("jailbreak");
    expect(profile.strongestCategory).toBe("jailbreak");
  });

  it("excludes categories with no results", () => {
    const results = [makeResult({ category: "injection" })];
    const profile = analyzeWeaknesses(results);
    // Only injection should appear
    expect(profile.categoryWeaknesses.length).toBe(1);
    expect(profile.categoryWeaknesses[0].category).toBe("injection");
  });

  it("caps confidence at 0.95", () => {
    // Generate many full_jailbreak successes to push confidence
    const results = Array.from({ length: 20 }, () =>
      makeResult({ success: true, classification: "full_jailbreak" }),
    );
    const profile = analyzeWeaknesses(results);
    const jbPattern = profile.vulnerabilityPatterns.find((p) =>
      p.description.includes("full jailbreak"),
    );
    expect(jbPattern!.confidence).toBeLessThanOrEqual(0.95);
  });
});

// ── generateFollowUpStrategy ─────────────────────────────────────────────────

describe("generateFollowUpStrategy", () => {
  it("returns exploratory attacks when no weaknesses found", () => {
    const profile: WeaknessProfile = {
      overallBreachRate: 0,
      categoryWeaknesses: [],
      vulnerabilityPatterns: [],
      strongestCategory: null,
      weakestCategory: null,
      mostVulnerableSeverity: null,
    };
    const plan = generateFollowUpStrategy(profile);
    expect(plan.attacks.length).toBeGreaterThan(0);
    expect(plan.targetWeaknesses[0]).toContain("No significant weaknesses");
    expect(plan.strategy).toContain("No clear weaknesses");
  });

  it("targets weak categories with >30% success rate", () => {
    const results = [
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    expect(plan.targetWeaknesses.length).toBeGreaterThan(0);
    expect(plan.targetWeaknesses[0]).toContain("Prompt Injection");
    // Should include injection follow-up attacks
    const hasInjectionAttack = plan.attacks.some((a) => a.category === "injection");
    expect(hasInjectionAttack).toBe(true);
  });

  it("includes attacks for vulnerability patterns", () => {
    const results = [
      makeResult({ success: true, classification: "full_jailbreak", category: "jailbreak" }),
      makeResult({ success: true, classification: "full_jailbreak", category: "jailbreak" }),
      makeResult({ success: false, category: "jailbreak" }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    const hasJailbreakAttack = plan.attacks.some((a) => a.category === "jailbreak");
    expect(hasJailbreakAttack).toBe(true);
  });

  it("does not duplicate attacks across categories and patterns", () => {
    const results = [
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: true }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    const names = plan.attacks.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("estimatedPayloadCount matches attacks length", () => {
    const results = [
      makeResult({ category: "extraction", success: true }),
      makeResult({ category: "extraction", success: true }),
      makeResult({ category: "extraction", success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    expect(plan.estimatedPayloadCount).toBe(plan.attacks.length);
  });

  it("each follow-up attack has required fields", () => {
    const results = [
      makeResult({ category: "bypass", success: true }),
      makeResult({ category: "bypass", success: true }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    for (const attack of plan.attacks) {
      expect(attack.name.length).toBeGreaterThan(0);
      expect(attack.prompt.length).toBeGreaterThan(0);
      expect(attack.reasoning.length).toBeGreaterThan(0);
      expect(["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"]).toContain(attack.category);
      expect(["critical", "high", "medium", "low"]).toContain(attack.severity);
    }
  });

  it("strategy mentions identified vulnerability patterns count", () => {
    const results = [
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    // Strategy should reference pattern count
    expect(plan.strategy).toContain("vulnerability pattern");
  });

  it("ignores categories below 30% success threshold", () => {
    const results = [
      makeResult({ category: "injection", success: true }),
      makeResult({ category: "injection", success: false }),
      makeResult({ category: "injection", success: false }),
      makeResult({ category: "injection", success: false }),
      makeResult({ category: "injection", success: false }),
    ];
    const profile = analyzeWeaknesses(results);
    const plan = generateFollowUpStrategy(profile);
    // 20% success rate — should not be in targetWeaknesses from category analysis
    const hasInjectionTarget = plan.targetWeaknesses.some((w) => w.includes("Prompt Injection"));
    expect(hasInjectionTarget).toBe(false);
  });

  it("covers all seven attack categories in follow-up templates", () => {
    const categories: AttackCategory[] = ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"];
    for (const cat of categories) {
      const results = [
        makeResult({ category: cat, success: true }),
        makeResult({ category: cat, success: true }),
        makeResult({ category: cat, success: true }),
      ];
      const profile = analyzeWeaknesses(results);
      const plan = generateFollowUpStrategy(profile);
      const hasCatAttack = plan.attacks.some((a) => a.category === cat);
      expect(hasCatAttack).toBe(true);
    }
  });
});
