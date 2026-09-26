import { describe, it, expect, beforeEach, vi } from "vitest";
import { useStore } from "@/lib/store";
import type { AttackRun, AttackResult, TargetConfig, Assessment } from "@/lib/types";
import { generateId } from "@/lib/uuid";

describe("Assessment Lifecycle State Synchronization", () => {
  const mockTarget: TargetConfig = {
    id: "target-test-1",
    name: "Test Target",
    endpoint: "https://api.example.com/v1/chat/completions",
    apiKey: "test-key",
    model: "gpt-4o",
    provider: "openai",
    connected: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      targets: [mockTarget],
      activeTargetId: "target-test-1",
      assessments: [],
      activeAssessmentId: null,
      runs: [],
      activeRunId: null,
      findings: [],
      isRunning: false,
    });
  });

  it("1. Running assessment appears in Running filter", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    const state = useStore.getState();
    const runningAssessments = state.assessments.filter((a) => a.status === "running");

    expect(runningAssessments).toHaveLength(1);
    expect(runningAssessments[0].id).toBe(assessmentId);
    expect(runningAssessments[0].status).toBe("running");
    expect(runningAssessments[0].targetName).toBe("Test Target");
  });

  it("2. Running assessment does not appear in Completed filter", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    const state = useStore.getState();
    const completedAssessments = state.assessments.filter((a) => a.status === "completed");

    expect(completedAssessments).toHaveLength(0);
  });

  it("3. Completed assessment appears in Completed filter and leaves Running filter", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);
    expect(useStore.getState().assessments.filter((a) => a.status === "running")).toHaveLength(1);

    // Complete the run
    useStore.getState().completeRun(runId);

    const state = useStore.getState();
    const runningAssessments = state.assessments.filter((a) => a.status === "running");
    const completedAssessments = state.assessments.filter((a) => a.status === "completed");

    expect(runningAssessments).toHaveLength(0);
    expect(completedAssessments).toHaveLength(1);
    expect(completedAssessments[0].id).toBe(assessmentId);
    expect(completedAssessments[0].status).toBe("completed");
    expect(completedAssessments[0].completedAt).toBeDefined();
  });

  it("4. Stopped assessment appears in Stopped filter and leaves Running filter", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);
    expect(useStore.getState().assessments.filter((a) => a.status === "running")).toHaveLength(1);

    // Cancel / Stop the run
    useStore.getState().cancelRun(runId);

    const state = useStore.getState();
    const runningAssessments = state.assessments.filter((a) => a.status === "running");
    const stoppedAssessments = state.assessments.filter((a) => a.status === "stopped");

    expect(runningAssessments).toHaveLength(0);
    expect(stoppedAssessments).toHaveLength(1);
    expect(stoppedAssessments[0].id).toBe(assessmentId);
    expect(stoppedAssessments[0].status).toBe("stopped");
  });

  it("5. Runner / execution changes assessment status to running", () => {
    const assessmentId = "assess-pre-created";
    const initialAssessment: Assessment = {
      id: assessmentId,
      name: "Pre-created Assessment",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      status: "ready",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: {
        categories: ["jailbreak"],
        payloadSelection: "all",
        includeVariants: false,
        adaptiveEnabled: false,
        evolveEnabled: false,
        concurrency: 1,
      },
      runIds: [],
    };

    useStore.getState().addAssessment(initialAssessment);
    expect(useStore.getState().assessments.find((a) => a.id === assessmentId)?.status).toBe("ready");

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["jailbreak"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    const updated = useStore.getState().assessments.find((a) => a.id === assessmentId);
    expect(updated?.status).toBe("running");
    expect(updated?.runIds).toContain(runId);
  });

  it("6. Completion changes assessment status to completed and calculates quantitative summary", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    // Add a successful breach result
    const breachResult: AttackResult = {
      id: "res-breach-1",
      payloadId: "inj-001",
      payloadName: "Instruction Hierarchy Override",
      category: "injection",
      severity: "critical",
      status: "success",
      prompt: "attack prompt",
      response: "bypassed instructions",
      timestamp: Date.now(),
      durationMs: 250,
      success: true,
      analysis: {
        classification: "full_jailbreak",
        severityScore: 9,
        confidence: 0.95,
        leakedData: [],
        reasoning: "Prompt bypassed safeguards",
        indicators: ["override"],
      },
    };

    useStore.getState().addResult(runId, breachResult);

    // Complete run
    useStore.getState().completeRun(runId);

    const finalAssessment = useStore.getState().assessments.find((a) => a.id === assessmentId);
    expect(finalAssessment?.status).toBe("completed");
    expect(finalAssessment?.summary).toBeDefined();
    expect(finalAssessment?.summary?.totalTests).toBe(1);
    expect(finalAssessment?.summary?.breachCount).toBe(1);
    expect(finalAssessment?.summary?.breachRate).toBe(100);

    // Derived findings should be generated
    const findings = useStore.getState().findings.filter((f) => f.assessmentId === assessmentId);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe("critical");
  });

  it("7. Cancellation changes assessment status to stopped", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);
    useStore.getState().cancelRun(runId);

    const assessment = useStore.getState().assessments.find((a) => a.id === assessmentId);
    expect(assessment?.status).toBe("stopped");
  });

  it("8. Assessment Workspace reacts to status change immediately", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    let state = useStore.getState();
    expect(state.assessments.filter((a) => a.status === "running")).toHaveLength(1);
    expect(state.assessments.filter((a) => a.status === "completed")).toHaveLength(0);

    useStore.getState().completeRun(runId);

    state = useStore.getState();
    expect(state.assessments.filter((a) => a.status === "running")).toHaveLength(0);
    expect(state.assessments.filter((a) => a.status === "completed")).toHaveLength(1);
  });

  it("9. Report Generator and Assessment Workspace reference the exact same assessment ID", () => {
    const assessmentId = generateId();
    const runId = generateId();

    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    const state = useStore.getState();
    const workspaceAssessment = state.assessments.find((a) => a.id === state.activeAssessmentId);
    const activeRun = state.runs.find((r) => r.id === state.activeRunId);

    expect(workspaceAssessment).toBeDefined();
    expect(activeRun).toBeDefined();
    expect(workspaceAssessment?.id).toBe(assessmentId);
    expect(activeRun?.assessmentId).toBe(assessmentId);
    expect(workspaceAssessment?.id).toBe(activeRun?.assessmentId);
  });

  it("10. Assessment ID remains stable throughout execution from draft/ready to running to completed", () => {
    const assessmentId = "stable-id-12345";
    const initialAssessment: Assessment = {
      id: assessmentId,
      name: "Stable ID Assessment",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      status: "ready",
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
      runIds: [],
    };

    useStore.getState().addAssessment(initialAssessment);
    useStore.getState().setActiveAssessment(assessmentId);

    // Launch run
    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId,
    };

    useStore.getState().addRun(run);

    let current = useStore.getState().assessments.find((a) => a.id === assessmentId);
    expect(current?.id).toBe(assessmentId);
    expect(current?.status).toBe("running");

    // Complete run
    useStore.getState().completeRun(runId);

    current = useStore.getState().assessments.find((a) => a.id === assessmentId);
    expect(current?.id).toBe(assessmentId);
    expect(current?.status).toBe("completed");
  });

  it("11. Any run added without an explicit assessmentId automatically creates/links an Assessment", () => {
    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection", "jailbreak"],
      results: [],
      startTime: Date.now(),
      status: "running",
    };

    useStore.getState().addRun(run);

    const state = useStore.getState();
    const storedRun = state.runs.find((r) => r.id === runId);
    expect(storedRun?.assessmentId).toBeDefined();

    const linkedAssessment = state.assessments.find((a) => a.id === storedRun?.assessmentId);
    expect(linkedAssessment).toBeDefined();
    expect(linkedAssessment?.status).toBe("running");
    expect(linkedAssessment?.targetName).toBe(mockTarget.name);
    expect(state.activeAssessmentId).toBe(linkedAssessment?.id);
  });
});
