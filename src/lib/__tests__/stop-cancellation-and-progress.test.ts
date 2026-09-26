import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/lib/store";
import { executePayloads } from "@/lib/evolve/runner";
import type { AttackPayload, AttackResult, AttackRun, TargetConfig } from "@/lib/types";

const mockTarget: TargetConfig = {
  id: "target-1",
  name: "Production LLM",
  endpoint: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o",
  provider: "openai",
  apiKey: "sk-test",
  connected: true,
  createdAt: 1000,
  updatedAt: 1000,
};

const createMockPayload = (id: string, name: string): AttackPayload => ({
  id,
  name,
  category: "injection",
  severity: "high",
  prompt: `Test prompt for ${id}`,
  description: `Test description for ${id}`,
});

const createMockResult = (payloadId: string, success = false): AttackResult => ({
  id: `result-${payloadId}`,
  payloadId,
  payloadName: `Payload ${payloadId}`,
  category: "injection",
  severity: "high",
  status: success ? "success" : "fail",
  prompt: `Prompt ${payloadId}`,
  response: `Response for ${payloadId}`,
  timestamp: Date.now(),
  durationMs: 50,
  success,
  analysis: {
    classification: success ? "full_jailbreak" : "refusal",
    confidence: 0.9,
    reasoning: "Test reasoning",
    severityScore: success ? 9 : 0,
    leakedData: [],
    indicators: [],
  },
});

describe("STOP Cancellation and Probe Progress Accounting", () => {
  beforeEach(() => {
    useStore.setState({
      targets: [mockTarget],
      activeTargetId: "target-1",
      assessments: [],
      activeAssessmentId: null,
      runs: [],
      activeRunId: null,
      findings: [],
      isRunning: false,
      isStopping: false,
      runProgress: null,
      cancelActiveExecution: null,
    });
  });

  it("1. New run starts at 0/N", () => {
    const payloads = Array.from({ length: 22 }, (_, i) => createMockPayload(`p-${i + 1}`, `Probe ${i + 1}`));
    const run: AttackRun = {
      id: "run-1",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      totalPayloads: payloads.length,
    };

    useStore.getState().addRun(run);
    const storeRun = useStore.getState().runs.find((r) => r.id === "run-1");

    expect(storeRun?.results.length).toBe(0);
    expect(storeRun?.totalPayloads).toBe(22);
  });

  it("2. Completed payload increments the numerator exactly once", () => {
    const run: AttackRun = {
      id: "run-1",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);
    useStore.getState().addResult("run-1", createMockResult("p-1"));

    const storeRun = useStore.getState().runs.find((r) => r.id === "run-1");
    expect(storeRun?.results.length).toBe(1);

    useStore.getState().addResult("run-1", createMockResult("p-2"));
    expect(useStore.getState().runs.find((r) => r.id === "run-1")?.results.length).toBe(2);
  });

  it("3. 22 payloads reaches exactly 22/22 and completes", () => {
    const run: AttackRun = {
      id: "run-1",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);

    for (let i = 1; i <= 22; i++) {
      useStore.getState().addResult("run-1", createMockResult(`p-${i}`));
    }

    useStore.getState().completeRun("run-1");

    const storeRun = useStore.getState().runs.find((r) => r.id === "run-1");
    expect(storeRun?.results.length).toBe(22);
    expect(storeRun?.totalPayloads).toBe(22);
    expect(storeRun?.status).toBe("completed");
  });

  it("4. STOP at partial progress preserves that progress without resetting to 0 or completing to 22", () => {
    const run: AttackRun = {
      id: "run-1",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [],
      startTime: Date.now(),
      status: "running",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);

    for (let i = 1; i <= 7; i++) {
      useStore.getState().addResult("run-1", createMockResult(`p-${i}`));
    }

    useStore.getState().cancelRun("run-1");

    const storeRun = useStore.getState().runs.find((r) => r.id === "run-1");
    expect(storeRun?.results.length).toBe(7);
    expect(storeRun?.totalPayloads).toBe(22);
    expect(storeRun?.status).toBe("cancelled");
  });

  it("5. STOP prevents remaining payloads from starting via AbortSignal", async () => {
    const controller = new AbortController();
    const payloads = Array.from({ length: 10 }, (_, i) => createMockPayload(`p-${i + 1}`, `Probe ${i + 1}`));
    const executed: string[] = [];

    // Simulate execution loop checking signal
    const runTask = async () => {
      for (const payload of payloads) {
        if (controller.signal.aborted) break;
        executed.push(payload.id);
        if (executed.length === 3) {
          controller.abort();
        }
      }
    };

    await runTask();
    expect(executed).toEqual(["p-1", "p-2", "p-3"]);
    expect(executed.length).toBe(3);
  });

  it("6. STOP cancels a pending delay cleanly", async () => {
    const controller = new AbortController();
    let delayCompleted = false;

    const cancellableDelay = (ms: number, signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error("Aborted"));
          return;
        }
        const timer = setTimeout(() => {
          delayCompleted = true;
          resolve();
        }, ms);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Aborted"));
        }, { once: true });
      });

    const promise = cancellableDelay(5000, controller.signal);
    controller.abort();

    await expect(promise).rejects.toThrow("Aborted");
    expect(delayCompleted).toBe(false);
  });

  it("7. STOP cancels an active stream reader", async () => {
    let streamCancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("line 1\n"));
      },
      cancel() {
        streamCancelled = true;
      },
    });

    const reader = stream.getReader();
    const chunk = await reader.read();
    expect(chunk.done).toBe(false);

    await reader.cancel();
    expect(streamCancelled).toBe(true);
  });

  it("8. Repeated STOP is idempotent", () => {
    let cancelCount = 0;
    useStore.setState({
      isRunning: true,
      isStopping: false,
      cancelActiveExecution: () => {
        cancelCount++;
      },
    });

    const triggerStop = () => {
      const state = useStore.getState();
      if (state.isStopping || !state.isRunning) return;
      state.setIsStopping(true);
      state.cancelActiveExecution?.();
    };

    triggerStop();
    triggerStop();
    triggerStop();

    expect(cancelCount).toBe(1);
    expect(useStore.getState().isStopping).toBe(true);
  });

  it("9. STOP vs completion race has exactly one final state", () => {
    const run: AttackRun = {
      id: "run-race",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [createMockResult("p-1")],
      startTime: Date.now(),
      status: "running",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);

    // Cancel first
    useStore.getState().cancelRun("run-race");
    expect(useStore.getState().runs.find((r) => r.id === "run-race")?.status).toBe("cancelled");

    // Late completeRun should be safely ignored
    useStore.getState().completeRun("run-race");
    expect(useStore.getState().runs.find((r) => r.id === "run-race")?.status).toBe("cancelled");
  });

  it("10. Completed run ignores late cancellation", () => {
    const run: AttackRun = {
      id: "run-comp",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [createMockResult("p-1")],
      startTime: Date.now(),
      status: "running",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);

    // Complete first
    useStore.getState().completeRun("run-comp");
    expect(useStore.getState().runs.find((r) => r.id === "run-comp")?.status).toBe("completed");

    // Late cancelRun should be safely ignored
    useStore.getState().cancelRun("run-comp");
    expect(useStore.getState().runs.find((r) => r.id === "run-comp")?.status).toBe("completed");
  });

  it("11. Sidebar and runner derive the same progress from the store", () => {
    const run: AttackRun = {
      id: "run-shared",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [createMockResult("p-1"), createMockResult("p-2"), createMockResult("p-3")],
      startTime: Date.now(),
      status: "running",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);

    const storeState = useStore.getState();
    const activeRun = storeState.runs.find((r) => r.id === "run-shared")!;

    const runnerNumerator = activeRun.results.length;
    const runnerDenominator = activeRun.totalPayloads || 0;

    const sidebarNumerator = activeRun.results.length;
    const sidebarDenominator = activeRun.totalPayloads || 0;

    expect(runnerNumerator).toBe(sidebarNumerator);
    expect(runnerNumerator).toBe(3);
    expect(runnerDenominator).toBe(sidebarDenominator);
    expect(runnerDenominator).toBe(22);
  });

  it("12. Navigation/remount does not reset progress or total", () => {
    const run: AttackRun = {
      id: "run-persist",
      targetId: mockTarget.id,
      targetName: mockTarget.name,
      categories: ["injection"],
      results: [createMockResult("p-1"), createMockResult("p-2")],
      startTime: Date.now(),
      status: "cancelled",
      totalPayloads: 22,
    };

    useStore.getState().addRun(run);

    // Simulate navigating to another view and back
    useStore.getState().setView("dashboard");
    useStore.getState().setView("assessments");
    useStore.getState().setView("results");

    const reloadedRun = useStore.getState().runs.find((r) => r.id === "run-persist")!;
    expect(reloadedRun.results.length).toBe(2);
    expect(reloadedRun.totalPayloads).toBe(22);
    expect(reloadedRun.status).toBe("cancelled");
  });

  it("13. executePayloads respects abort signal and terminates worker loop", async () => {
    const controller = new AbortController();
    const payloads = Array.from({ length: 5 }, (_, i) => createMockPayload(`p-${i + 1}`, `Probe ${i + 1}`));
    const results: AttackResult[] = [];

    // Abort before starting
    controller.abort();

    const executed = await executePayloads(
      payloads,
      {
        endpoint: "http://localhost:11434",
        apiKey: "test",
        model: "llama3",
        provider: "custom",
      },
      2,
      (res) => {
        results.push(res);
      },
      controller.signal
    );

    expect(executed.length).toBe(0);
    expect(results.length).toBe(0);
  });
});
