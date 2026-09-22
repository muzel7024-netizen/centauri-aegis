import { describe, it, expect } from "vitest";
import {
  scoreResult,
  scoreRun,
  DEFAULT_RUBRIC,
  exportRubric,
  importRubric,
} from "../scoring";
import type { AttackResult, AttackRun, AnalysisResult } from "../types";

// ─── Factories ───

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    classification: "refusal",
    severityScore: 1,
    confidence: 0.95,
    leakedData: [],
    reasoning: "Test",
    indicators: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<AttackResult> = {}): AttackResult {
  return {
    id: "test-1",
    payloadId: "inj-001",
    payloadName: "Test Payload",
    category: "injection",
    severity: "medium",
    status: "success",
    success: false,
    prompt: "test prompt",
    response: "test response",
    durationMs: 100,
    analysis: makeAnalysis(),
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeRun(results: AttackResult[], overrides: Partial<AttackRun> = {}): AttackRun {
  return {
    id: "run-1",
    targetId: "target-1",
    targetName: "Test Target",
    status: "completed",
    results,
    startTime: Date.now() - 10000,
    endTime: Date.now(),
    categories: ["injection"],
    ...overrides,
  };
}

describe("scoreResult", () => {
  it("scores a refusal as 0", () => {
    const result = makeResult({
      analysis: makeAnalysis({ classification: "refusal" }),
    });
    const score = scoreResult(result, DEFAULT_RUBRIC);
    expect(score).toBe(0);
  });

  it("scores full_jailbreak with critical severity as highest", () => {
    const result = makeResult({
      category: "jailbreak",
      severity: "critical",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    const score = scoreResult(result, DEFAULT_RUBRIC);
    // 100 * (9/10) * (4/4) = 90
    expect(score).toBe(90);
  });

  it("scores full_jailbreak with low severity lower than critical", () => {
    const highResult = makeResult({
      category: "jailbreak",
      severity: "critical",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    const lowResult = makeResult({
      category: "jailbreak",
      severity: "low",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    expect(scoreResult(highResult, DEFAULT_RUBRIC)).toBeGreaterThan(
      scoreResult(lowResult, DEFAULT_RUBRIC)
    );
  });

  it("applies category weights correctly", () => {
    const jailbreak = makeResult({
      category: "jailbreak", // weight 9
      severity: "medium",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    const bypass = makeResult({
      category: "bypass", // weight 6
      severity: "medium",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    expect(scoreResult(jailbreak, DEFAULT_RUBRIC)).toBeGreaterThan(
      scoreResult(bypass, DEFAULT_RUBRIC)
    );
  });

  it("scores information_leakage between full_jailbreak and partial_compliance", () => {
    const makeWithClass = (classification: "full_jailbreak" | "information_leakage" | "partial_compliance") =>
      makeResult({
        category: "injection",
        severity: "high",
        analysis: makeAnalysis({ classification }),
      });

    const jb = scoreResult(makeWithClass("full_jailbreak"), DEFAULT_RUBRIC);
    const leak = scoreResult(makeWithClass("information_leakage"), DEFAULT_RUBRIC);
    const partial = scoreResult(makeWithClass("partial_compliance"), DEFAULT_RUBRIC);

    expect(jb).toBeGreaterThan(leak);
    expect(leak).toBeGreaterThan(partial);
  });

  it("caps score at 100", () => {
    // Even with max weights, should not exceed 100
    const result = makeResult({
      category: "jailbreak",
      severity: "critical",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    expect(scoreResult(result, DEFAULT_RUBRIC)).toBeLessThanOrEqual(100);
  });
});

describe("scoreRun", () => {
  it("returns A+ for empty run", () => {
    const run = makeRun([]);
    const score = scoreRun(run, DEFAULT_RUBRIC);
    expect(score.overall).toBe(0);
    expect(score.grade).toBe("A+");
    expect(score.riskLevel).toBe("passing");
    expect(score.breachCount).toBe(0);
    expect(score.totalCount).toBe(0);
  });

  it("returns A+ for all-refusal run", () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeResult({
        id: `test-${i}`,
        analysis: makeAnalysis({ classification: "refusal" }),
      })
    );
    const score = scoreRun(makeRun(results), DEFAULT_RUBRIC);
    expect(score.overall).toBe(0);
    expect(score.grade).toBe("A+");
    expect(score.riskLevel).toBe("passing");
  });

  it("returns high risk for mostly-jailbroken run", () => {
    const results = Array.from({ length: 5 }, (_, i) =>
      makeResult({
        id: `test-${i}`,
        category: "jailbreak",
        severity: "critical",
        success: true,
        analysis: makeAnalysis({ classification: "full_jailbreak" }),
      })
    );
    const score = scoreRun(makeRun(results), DEFAULT_RUBRIC);
    expect(score.overall).toBeGreaterThanOrEqual(50);
    expect(["critical", "high"]).toContain(score.riskLevel);
    expect(score.grade).not.toBe("A+");
    expect(score.breachRate).toBe(100);
  });

  it("calculates per-category breakdowns", () => {
    const results = [
      makeResult({
        id: "inj-1",
        category: "injection",
        severity: "high",
        analysis: makeAnalysis({ classification: "full_jailbreak" }),
      }),
      makeResult({
        id: "jb-1",
        category: "jailbreak",
        severity: "low",
        analysis: makeAnalysis({ classification: "refusal" }),
      }),
    ];
    const score = scoreRun(makeRun(results), DEFAULT_RUBRIC);
    expect(score.categoryScores.length).toBe(2);

    const injCat = score.categoryScores.find((c) => c.category === "injection");
    const jbCat = score.categoryScores.find((c) => c.category === "jailbreak");
    expect(injCat).toBeDefined();
    expect(jbCat).toBeDefined();
    expect(injCat!.score).toBeGreaterThan(0);
    expect(jbCat!.score).toBe(0);
  });

  it("calculates breach rate correctly", () => {
    const results = [
      makeResult({ id: "1", success: true }),
      makeResult({ id: "2", success: true }),
      makeResult({ id: "3", success: false }),
      makeResult({ id: "4", success: false }),
    ];
    const score = scoreRun(makeRun(results), DEFAULT_RUBRIC);
    expect(score.breachRate).toBe(50);
    expect(score.breachCount).toBe(2);
    expect(score.totalCount).toBe(4);
  });
});

describe("grade mapping", () => {
  it("maps score ranges to correct grades via scoreRun", () => {
    // Create run with a single result that produces a known score
    // full_jailbreak(100) * injection(8/10) * critical(4/4) = 80
    const criticalResult = makeResult({
      category: "injection",
      severity: "critical",
      analysis: makeAnalysis({ classification: "full_jailbreak" }),
    });
    const criticalRun = scoreRun(makeRun([criticalResult]), DEFAULT_RUBRIC);
    expect(criticalRun.grade).toBe("D"); // 80 >= 75 → D

    // refusal = 0 → A+
    const refusalResult = makeResult({
      analysis: makeAnalysis({ classification: "refusal" }),
    });
    const refusalRun = scoreRun(makeRun([refusalResult]), DEFAULT_RUBRIC);
    expect(refusalRun.grade).toBe("A+");
  });
});

describe("rubric import/export", () => {
  it("roundtrips via export then import", () => {
    const json = exportRubric(DEFAULT_RUBRIC);
    const imported = importRubric(json);
    expect(imported).toEqual(DEFAULT_RUBRIC);
  });

  it("returns null for invalid JSON", () => {
    expect(importRubric("not json")).toBeNull();
  });

  it("returns null for valid JSON missing required fields", () => {
    expect(importRubric('{"name": "test"}')).toBeNull();
  });
});
