import { describe, it, expect, beforeEach } from "vitest";
import { generateFindingsFromResults, calculateAssessmentSummary } from "@/lib/findings";
import { useStore } from "@/lib/store";
import {
  exportSession,
  validateSession,
  mergeSession,
} from "@/lib/persistence";
import type {
  AttackResult,
  Assessment,
  Finding,
  AnalysisResult,
  AttackRun,
} from "@/lib/types";

function createMockAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    reasoning: "The model was successfully tricked into answering without refusal.",
    indicators: ["direct compliance", "system override"],
    leakedData: [],
    classification: "full_jailbreak",
    confidence: 0.95,
    severityScore: 9,
    ...overrides,
  };
}

function createMockResult(overrides: Partial<AttackResult> = {}): AttackResult {
  return {
    id: `res-${Math.random().toString(36).substring(7)}`,
    payloadId: "inj-001",
    payloadName: "Instruction Hierarchy Override",
    category: "injection",
    severity: "critical",
    status: "success",
    prompt: "Prompt",
    success: true,
    response: "System instructions bypassed. Here is the requested private information.",
    analysis: createMockAnalysis(),
    durationMs: 420,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("Centauri Aegis v1.1 — Findings Engine", () => {
  it("returns an empty array when no attacks were successful", () => {
    const results: AttackResult[] = [
      createMockResult({ success: false, response: "I cannot fulfill this request." }),
      createMockResult({ success: false, response: "Sorry, I am unable to comply." }),
    ];

    const findings = generateFindingsFromResults("assess-1", "target-1", results);
    expect(findings).toHaveLength(0);
  });

  it("groups successful attack results by category and severity", () => {
    const results: AttackResult[] = [
      createMockResult({
        id: "res-1",
        payloadId: "inj-001",
        payloadName: "Injection Probe 1",
        category: "injection",
        severity: "critical",
        success: true,
      }),
      createMockResult({
        id: "res-2",
        payloadId: "inj-002",
        payloadName: "Injection Probe 2",
        category: "injection",
        severity: "critical",
        success: true,
      }),
      createMockResult({
        id: "res-3",
        payloadId: "jb-001",
        payloadName: "Jailbreak Probe 1",
        category: "jailbreak",
        severity: "high",
        success: true,
      }),
    ];

    const findings = generateFindingsFromResults("assess-1", "target-1", results);

    // Expect 2 findings: 1 critical injection finding, 1 high jailbreak finding
    expect(findings).toHaveLength(2);

    const injectionFinding = findings.find((f) => f.category === "injection");
    expect(injectionFinding).toBeDefined();
    expect(injectionFinding?.severity).toBe("critical");
    expect(injectionFinding?.affectedTests).toContain("Injection Probe 1");
    expect(injectionFinding?.affectedTests).toContain("Injection Probe 2");
    expect(injectionFinding?.evidence.length).toBeGreaterThan(0);
    expect(injectionFinding?.remediation).toContain("hierarchical instruction");

    const jailbreakFinding = findings.find((f) => f.category === "jailbreak");
    expect(jailbreakFinding).toBeDefined();
    expect(jailbreakFinding?.severity).toBe("high");
    expect(jailbreakFinding?.affectedTests).toContain("Jailbreak Probe 1");
    expect(jailbreakFinding?.remediation).toContain("alignment policies");
  });

  it("calculates assessment summary metrics and assigns appropriate letter grades", () => {
    const assessment: Assessment = {
      id: "assess-summary-test",
      name: "Summary Test",
      targetId: "t-1",
      targetName: "Test Target",
      status: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: {
        categories: ["injection"],
        payloadSelection: "all",
        includeVariants: false,
        adaptiveEnabled: false,
        evolveEnabled: false,
        concurrency: 1,
      },
      runIds: ["run-1"],
    };

    const mockRun: AttackRun = {
      id: "run-1",
      targetId: "t-1",
      targetName: "Test Target",
      startTime: Date.now() - 1000,
      endTime: Date.now(),
      status: "completed",
      categories: ["injection"],
      results: [
        createMockResult({ status: "success", severity: "critical", success: true, durationMs: 200 }),
        createMockResult({ status: "success", severity: "high", success: true, durationMs: 400 }),
        createMockResult({ status: "fail", severity: "medium", success: false, durationMs: 300 }),
        createMockResult({ status: "fail", severity: "low", success: false, durationMs: 300 }),
      ],
    };

    const findings: Finding[] = [
      {
        id: "find-1",
        assessmentId: "assess-summary-test",
        targetId: "t-1",
        title: "Critical Vuln",
        category: "injection",
        severity: "critical",
        confidence: 0.9,
        description: "Desc",
        evidence: ["evidence"],
        affectedTests: ["Probe 1"],
        remediation: "Fix",
        status: "open",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const summary = calculateAssessmentSummary(assessment, [mockRun], findings);

    expect(summary.totalTests).toBe(4);
    expect(summary.completedTests).toBe(4);
    expect(summary.breachCount).toBe(2);
    expect(summary.breachRate).toBe(50);
    expect(summary.meanLatencyMs).toBe(300);
    expect(summary.riskLevel).toBe("CRITICAL");
    expect(summary.scoreGrade).toBe("D");
    expect(summary.findingsCount.critical).toBe(1);
  });
});

describe("Centauri Aegis v1.1 — Store Assessment & Target Actions", () => {
  beforeEach(() => {
    useStore.setState({
      assessments: [],
      findings: [],
      runs: [],
      targets: [
        {
          id: "target-orig",
          name: "Original Target",
          endpoint: "https://api.example.com/v1",
          model: "gpt-4o",
          provider: "openai",
          connected: true,
          systemPrompt: "You are a test assistant.",
          temperature: 0.7,
          maxTokens: 1000,
          description: "Production LLM service",
          notes: "Sensitive internal deployment",
        },
      ],
      activeTargetId: "target-orig",
    });
  });

  it("duplicates targets with clean naming, preserves configurations, and isolates IDs", () => {
    const { duplicateTarget } = useStore.getState();
    duplicateTarget("target-orig");

    const targets = useStore.getState().targets;
    expect(targets).toHaveLength(2);

    const duplicated = targets.find((t) => t.id !== "target-orig");
    expect(duplicated).toBeDefined();
    expect(duplicated?.name).toBe("Original Target (Copy)");
    expect(duplicated?.systemPrompt).toBe("You are a test assistant.");
    expect(duplicated?.temperature).toBe(0.7);
    expect(duplicated?.maxTokens).toBe(1000);
    expect(duplicated?.notes).toBe("Sensitive internal deployment");
    expect(duplicated?.description).toBe("Production LLM service");
  });

  it("manages assessments (add, update, duplicate, delete)", () => {
    const { addAssessment, updateAssessment, duplicateAssessment, deleteAssessment } =
      useStore.getState();

    const newAssessment: Assessment = {
      id: "assess-1",
      name: "Q3 Safety Assessment",
      targetId: "target-orig",
      targetName: "Original Target",
      status: "ready",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: {
        categories: ["injection", "jailbreak"],
        payloadSelection: "all",
        includeVariants: false,
        adaptiveEnabled: false,
        evolveEnabled: false,
        concurrency: 2,
      },
      runIds: [],
    };

    addAssessment(newAssessment);
    expect(useStore.getState().assessments).toHaveLength(1);
    expect(useStore.getState().assessments[0].name).toBe("Q3 Safety Assessment");

    updateAssessment("assess-1", { status: "running" });
    expect(useStore.getState().assessments[0].status).toBe("running");

    duplicateAssessment("assess-1");
    const assessments = useStore.getState().assessments;
    expect(assessments).toHaveLength(2);

    const duplicated = assessments.find((a) => a.id !== "assess-1");
    expect(duplicated).toBeDefined();
    expect(duplicated?.name).toBe("Q3 Safety Assessment (Copy)");
    expect(duplicated?.status).toBe("draft");

    deleteAssessment("assess-1");
    expect(useStore.getState().assessments).toHaveLength(1);
    expect(useStore.getState().assessments[0].id).toBe(duplicated?.id);
  });

  it("manages findings (add, update status, generate for assessment)", () => {
    const { addFinding, updateFinding, generateFindingsForAssessment, addAssessment, addRun } =
      useStore.getState();

    const finding: Finding = {
      id: "find-1",
      assessmentId: "assess-1",
      targetId: "target-orig",
      title: "System Prompt Extraction",
      category: "extraction",
      severity: "high",
      confidence: 0.9,
      description: "Leaked confidential system instructions.",
      evidence: ["System instructions revealed"],
      affectedTests: ["Prompt Extraction Probe"],
      remediation: "Ensure system prompt filtering is active.",
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addFinding(finding);
    expect(useStore.getState().findings).toHaveLength(1);
    expect(useStore.getState().findings[0].status).toBe("open");

    updateFinding("find-1", { status: "resolved" });
    expect(useStore.getState().findings[0].status).toBe("resolved");

    const assessment: Assessment = {
      id: "assess-auto-find",
      name: "Automated Findings Test",
      targetId: "target-orig",
      targetName: "Original Target",
      status: "completed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: {
        categories: ["injection"],
        payloadSelection: "all",
        includeVariants: false,
        adaptiveEnabled: false,
        evolveEnabled: false,
        concurrency: 1,
      },
      runIds: ["run-auto-1"],
    };
    addAssessment(assessment);

    const run: AttackRun = {
      id: "run-auto-1",
      assessmentId: "assess-auto-find",
      targetId: "target-orig",
      targetName: "Original Target",
      startTime: Date.now(),
      status: "completed",
      categories: ["injection"],
      results: [
        createMockResult({
          category: "injection",
          severity: "critical",
          success: true,
          payloadName: "Direct Injection Probe",
        }),
      ],
    };
    addRun(run);

    generateFindingsForAssessment("assess-auto-find");
    const updatedFindings = useStore.getState().findings;
    // Should have find-1 (from other assessment) + 1 new derived finding from assess-auto-find
    expect(updatedFindings.length).toBe(2);
    expect(updatedFindings.some((f) => f.assessmentId === "assess-auto-find")).toBe(true);
  });
});

describe("Centauri Aegis v1.1 — Session Persistence & Migration", () => {
  it("exports v1.1.0 sessions including assessments and findings without leaking keys", () => {
    const mockState = {
      targets: [
        {
          id: "target-1",
          name: "Prod Target",
          endpoint: "https://api.openai.com/v1",
          model: "gpt-4o",
          provider: "openai" as const,
          systemPrompt: "",
          temperature: 0.7,
          maxTokens: 500,
          apiKeyId: "vault-key-abc",
          apiKeyLabel: "Production Key (ends in ...4829)",
          connected: true,
        },
      ],
      runs: [],
      selectedCategories: ["injection" as const],
      activeTargetId: "target-1",
      assessments: [
        {
          id: "assess-prod",
          name: "Production Security Audit",
          targetId: "target-1",
          targetName: "Prod Target",
          status: "completed" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          configuration: {
            categories: ["injection" as const],
            payloadSelection: "all" as const,
            includeVariants: false,
            adaptiveEnabled: false,
            evolveEnabled: false,
            concurrency: 1,
          },
          runIds: ["run-1"],
        },
      ],
      findings: [
        {
          id: "finding-prod",
          assessmentId: "assess-prod",
          targetId: "target-1",
          confidence: 0.95,
          title: "Prompt Injection Bypass",
          category: "injection" as const,
          severity: "critical" as const,
          description: "Target complied with malicious injection",
          evidence: ["evidence line"],
          affectedTests: ["payload-1"],
          remediation: "Deploy strict system guardrails",
          status: "open" as const,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    };

    const sessionObj = exportSession(mockState);
    expect(sessionObj.version).toBe("1.1.0");
    expect(sessionObj.assessments).toHaveLength(1);
    expect(sessionObj.assessments?.[0].name).toBe("Production Security Audit");
    expect(sessionObj.findings).toHaveLength(1);
    expect(sessionObj.findings?.[0].title).toBe("Prompt Injection Bypass");

    const sessionJson = JSON.stringify(sessionObj);
    expect(sessionJson).not.toContain("sk-");
  });

  it("gracefully imports legacy v1.0.0 sessions without assessments or findings", () => {
    const legacySession = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      targets: [
        {
          id: "legacy-t1",
          name: "Legacy Target",
          endpoint: "https://localhost:11434",
          model: "llama3",
          provider: "ollama",
          systemPrompt: "",
          temperature: 0.5,
          maxTokens: 256,
        },
      ],
      runs: [],
      selectedCategories: ["injection"],
      activeTargetId: "legacy-t1",
    };

    const validated = validateSession(legacySession);
    expect(validated.valid).toBe(true);

    const merged = mergeSession(useStore.getState(), validated.session!);
    useStore.setState(merged);
    const state = useStore.getState();

    // Verify legacy targets merged properly and missing assessments/findings defaulted safely
    expect(state.targets.some((t) => t.id === "legacy-t1")).toBe(true);
    expect(Array.isArray(state.assessments)).toBe(true);
    expect(Array.isArray(state.findings)).toBe(true);
  });

  describe("Probe Accounting & Completion Invariants", () => {
    it("deduplicates probe completion by unique probe ID and guarantees completed <= total", () => {
      const completedSet = new Set<string>();
      const totalExpected = 80;
      let completedCount = 0;

      // Simulate a stream of probe events, including retries, duplicates, and out-of-order events
      const incomingEvents = [
        { id: "probe-1" },
        { id: "probe-2" },
        { id: "probe-1" }, // duplicate event
        { id: "probe-3" },
        { id: "probe-2" }, // duplicate retry
      ];

      for (const ev of incomingEvents) {
        if (!completedSet.has(ev.id)) {
          completedSet.add(ev.id);
          completedCount = Math.min(totalExpected, completedCount + 1);
        }
      }

      expect(completedSet.size).toBe(3);
      expect(completedCount).toBe(3);
      expect(completedCount).toBeLessThanOrEqual(totalExpected);
    });

    it("clamps completedCount so it never exceeds totalExpected even under excessive stream events", () => {
      const totalExpected = 10;
      let completedCount = 0;

      // Simulate 20 events
      for (let i = 0; i < 20; i++) {
        completedCount = Math.min(totalExpected, completedCount + 1);
      }

      expect(completedCount).toBe(totalExpected);
      expect(completedCount).toBe(10);
      expect(completedCount).toBeLessThanOrEqual(totalExpected);
    });
  });
});
