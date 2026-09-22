import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "../store";
import type { TargetConfig, AttackRun, AttackResult } from "../types";

function makeTarget(overrides: Partial<TargetConfig> = {}): TargetConfig {
  return {
    id: "t-1",
    name: "Test Target",
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: "sk-test-key-123",
    model: "gpt-4",
    provider: "openai",
    connected: false,
    ...overrides,
  };
}

function makeRun(overrides: Partial<AttackRun> = {}): AttackRun {
  return {
    id: "run-1",
    targetId: "t-1",
    targetName: "Test Target",
    categories: ["injection"],
    results: [],
    startTime: Date.now(),
    status: "running",
    ...overrides,
  };
}

function makeResult(overrides: Partial<AttackResult> = {}): AttackResult {
  return {
    id: "r-1",
    payloadId: "inj-001",
    payloadName: "Basic Injection",
    category: "injection",
    severity: "high",
    status: "success",
    prompt: "test prompt",
    response: "test response",
    timestamp: Date.now(),
    durationMs: 500,
    success: true,
    analysis: {
      classification: "full_jailbreak",
      severityScore: 8,
      confidence: 0.9,
      leakedData: [],
      reasoning: "Model complied",
      indicators: ["direct_compliance"],
    },
    ...overrides,
  };
}

describe("store", () => {
  beforeEach(() => {
    // Reset store to initial state
    useStore.setState({
      targets: [],
      activeTargetId: null,
      selectedCategories: ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"],
      runs: [],
      activeRunId: null,
      concurrency: 1,
      runProgress: null,
      redTeamConfig: null,
      view: "config",
      isRunning: false,
    });
  });

  describe("targets", () => {
    it("starts with empty targets", () => {
      expect(useStore.getState().targets).toEqual([]);
      expect(useStore.getState().activeTargetId).toBeNull();
    });

    it("adds a target", () => {
      const target = makeTarget();
      useStore.getState().addTarget(target);
      expect(useStore.getState().targets).toHaveLength(1);
      expect(useStore.getState().targets[0]).toEqual(target);
    });

    it("adds multiple targets", () => {
      useStore.getState().addTarget(makeTarget({ id: "t-1" }));
      useStore.getState().addTarget(makeTarget({ id: "t-2", name: "Second" }));
      expect(useStore.getState().targets).toHaveLength(2);
    });

    it("updates a target", () => {
      useStore.getState().addTarget(makeTarget());
      useStore.getState().updateTarget("t-1", { name: "Updated Name", model: "gpt-4o" });
      const updated = useStore.getState().targets[0];
      expect(updated.name).toBe("Updated Name");
      expect(updated.model).toBe("gpt-4o");
      expect(updated.endpoint).toBe("https://api.openai.com/v1/chat/completions"); // unchanged
    });

    it("update does not affect other targets", () => {
      useStore.getState().addTarget(makeTarget({ id: "t-1" }));
      useStore.getState().addTarget(makeTarget({ id: "t-2", name: "Second" }));
      useStore.getState().updateTarget("t-1", { name: "Updated" });
      expect(useStore.getState().targets[1].name).toBe("Second");
    });

    it("removes a target", () => {
      useStore.getState().addTarget(makeTarget());
      useStore.getState().removeTarget("t-1");
      expect(useStore.getState().targets).toHaveLength(0);
    });

    it("clears activeTargetId when removing the active target", () => {
      useStore.getState().addTarget(makeTarget());
      useStore.getState().setActiveTarget("t-1");
      useStore.getState().removeTarget("t-1");
      expect(useStore.getState().activeTargetId).toBeNull();
    });

    it("preserves activeTargetId when removing a different target", () => {
      useStore.getState().addTarget(makeTarget({ id: "t-1" }));
      useStore.getState().addTarget(makeTarget({ id: "t-2" }));
      useStore.getState().setActiveTarget("t-1");
      useStore.getState().removeTarget("t-2");
      expect(useStore.getState().activeTargetId).toBe("t-1");
    });

    it("sets active target", () => {
      useStore.getState().setActiveTarget("t-1");
      expect(useStore.getState().activeTargetId).toBe("t-1");
    });

    it("sets active target to null", () => {
      useStore.getState().setActiveTarget("t-1");
      useStore.getState().setActiveTarget(null);
      expect(useStore.getState().activeTargetId).toBeNull();
    });
  });

  describe("categories", () => {
    it("starts with all categories selected", () => {
      const cats = useStore.getState().selectedCategories;
      expect(cats).toContain("injection");
      expect(cats).toContain("jailbreak");
      expect(cats).toContain("extraction");
      expect(cats).toContain("bypass");
      expect(cats).toContain("tool_abuse");
      expect(cats).toContain("multi_turn");
      expect(cats).toContain("encoding");
      expect(cats).toHaveLength(7);
    });

    it("toggles a category off", () => {
      useStore.getState().toggleCategory("injection");
      expect(useStore.getState().selectedCategories).not.toContain("injection");
      expect(useStore.getState().selectedCategories).toHaveLength(6);
    });

    it("toggles a category back on", () => {
      useStore.getState().toggleCategory("injection");
      useStore.getState().toggleCategory("injection");
      expect(useStore.getState().selectedCategories).toContain("injection");
    });

    it("sets categories directly", () => {
      useStore.getState().setCategories(["injection", "bypass"]);
      expect(useStore.getState().selectedCategories).toEqual(["injection", "bypass"]);
    });

    it("sets empty categories", () => {
      useStore.getState().setCategories([]);
      expect(useStore.getState().selectedCategories).toEqual([]);
    });
  });

  describe("runs", () => {
    it("starts with empty runs", () => {
      expect(useStore.getState().runs).toEqual([]);
      expect(useStore.getState().activeRunId).toBeNull();
    });

    it("adds a run (prepends)", () => {
      const run1 = makeRun({ id: "run-1" });
      const run2 = makeRun({ id: "run-2" });
      useStore.getState().addRun(run1);
      useStore.getState().addRun(run2);
      const runs = useStore.getState().runs;
      expect(runs).toHaveLength(2);
      expect(runs[0].id).toBe("run-2"); // most recent first
      expect(runs[1].id).toBe("run-1");
    });

    it("adds a result to a run", () => {
      useStore.getState().addRun(makeRun());
      const result = makeResult();
      useStore.getState().addResult("run-1", result);
      const run = useStore.getState().runs[0];
      expect(run.results).toHaveLength(1);
      expect(run.results[0]).toEqual(result);
    });

    it("adds multiple results to a run", () => {
      useStore.getState().addRun(makeRun());
      useStore.getState().addResult("run-1", makeResult({ id: "r-1" }));
      useStore.getState().addResult("run-1", makeResult({ id: "r-2" }));
      useStore.getState().addResult("run-1", makeResult({ id: "r-3" }));
      expect(useStore.getState().runs[0].results).toHaveLength(3);
    });

    it("does not add result to non-existent run", () => {
      useStore.getState().addRun(makeRun());
      useStore.getState().addResult("nonexistent", makeResult());
      expect(useStore.getState().runs[0].results).toHaveLength(0);
    });

    it("completes a run", () => {
      useStore.getState().addRun(makeRun());
      useStore.getState().completeRun("run-1");
      const run = useStore.getState().runs[0];
      expect(run.status).toBe("completed");
      expect(run.endTime).toBeDefined();
      expect(typeof run.endTime).toBe("number");
    });

    it("cancels a run", () => {
      useStore.getState().addRun(makeRun());
      useStore.getState().cancelRun("run-1");
      const run = useStore.getState().runs[0];
      expect(run.status).toBe("cancelled");
      expect(run.endTime).toBeDefined();
    });

    it("deletes a run", () => {
      useStore.getState().addRun(makeRun());
      useStore.getState().deleteRun("run-1");
      expect(useStore.getState().runs).toHaveLength(0);
    });

    it("clears activeRunId when deleting active run", () => {
      useStore.getState().addRun(makeRun());
      useStore.getState().setActiveRun("run-1");
      useStore.getState().deleteRun("run-1");
      expect(useStore.getState().activeRunId).toBeNull();
    });

    it("preserves activeRunId when deleting a different run", () => {
      useStore.getState().addRun(makeRun({ id: "run-1" }));
      useStore.getState().addRun(makeRun({ id: "run-2" }));
      useStore.getState().setActiveRun("run-1");
      useStore.getState().deleteRun("run-2");
      expect(useStore.getState().activeRunId).toBe("run-1");
    });

    it("sets active run", () => {
      useStore.getState().setActiveRun("run-1");
      expect(useStore.getState().activeRunId).toBe("run-1");
    });
  });

  describe("concurrency", () => {
    it("defaults to 1", () => {
      expect(useStore.getState().concurrency).toBe(1);
    });

    it("sets concurrency within range", () => {
      useStore.getState().setConcurrency(5);
      expect(useStore.getState().concurrency).toBe(5);
    });

    it("clamps concurrency to minimum of 1", () => {
      useStore.getState().setConcurrency(0);
      expect(useStore.getState().concurrency).toBe(1);
      useStore.getState().setConcurrency(-5);
      expect(useStore.getState().concurrency).toBe(1);
    });

    it("clamps concurrency to maximum of 10", () => {
      useStore.getState().setConcurrency(15);
      expect(useStore.getState().concurrency).toBe(10);
      useStore.getState().setConcurrency(100);
      expect(useStore.getState().concurrency).toBe(10);
    });
  });

  describe("run progress", () => {
    it("starts with null progress", () => {
      expect(useStore.getState().runProgress).toBeNull();
    });

    it("sets run progress", () => {
      const progress = { total: 50, completed: 10, startTime: Date.now() };
      useStore.getState().setRunProgress(progress);
      expect(useStore.getState().runProgress).toEqual(progress);
    });

    it("clears run progress", () => {
      useStore.getState().setRunProgress({ total: 50, completed: 10, startTime: Date.now() });
      useStore.getState().setRunProgress(null);
      expect(useStore.getState().runProgress).toBeNull();
    });

    it("increments progress", () => {
      useStore.getState().setRunProgress({ total: 50, completed: 10, startTime: Date.now() });
      useStore.getState().incrementRunProgress();
      expect(useStore.getState().runProgress?.completed).toBe(11);
    });

    it("increment does nothing when progress is null", () => {
      useStore.getState().incrementRunProgress();
      expect(useStore.getState().runProgress).toBeNull();
    });

    it("preserves total and startTime on increment", () => {
      const startTime = Date.now();
      useStore.getState().setRunProgress({ total: 50, completed: 10, startTime });
      useStore.getState().incrementRunProgress();
      const p = useStore.getState().runProgress!;
      expect(p.total).toBe(50);
      expect(p.startTime).toBe(startTime);
    });
  });

  describe("red team config", () => {
    it("starts with null", () => {
      expect(useStore.getState().redTeamConfig).toBeNull();
    });

    it("sets red team config", () => {
      const config = makeTarget({ id: "rt-1", name: "Red Team LLM" });
      useStore.getState().setRedTeamConfig(config);
      expect(useStore.getState().redTeamConfig).toEqual(config);
    });

    it("clears red team config", () => {
      useStore.getState().setRedTeamConfig(makeTarget());
      useStore.getState().setRedTeamConfig(null);
      expect(useStore.getState().redTeamConfig).toBeNull();
    });

    it("updates red team config fields", () => {
      useStore.getState().setRedTeamConfig(makeTarget());
      useStore.getState().updateRedTeamConfig({ model: "claude-4-sonnet" });
      expect(useStore.getState().redTeamConfig?.model).toBe("claude-4-sonnet");
      expect(useStore.getState().redTeamConfig?.endpoint).toBe("https://api.openai.com/v1/chat/completions");
    });

    it("update does nothing when config is null", () => {
      useStore.getState().updateRedTeamConfig({ model: "test" });
      expect(useStore.getState().redTeamConfig).toBeNull();
    });
  });

  describe("UI state", () => {
    it("starts with config view", () => {
      expect(useStore.getState().view).toBe("config");
    });

    it("sets view", () => {
      useStore.getState().setView("results");
      expect(useStore.getState().view).toBe("results");
    });

    it("cycles through views", () => {
      const views = ["config", "attacks", "results", "reports", "chains", "session", "editor", "comparison", "adaptive", "evolve", "heatmap", "regression", "scoring"] as const;
      for (const v of views) {
        useStore.getState().setView(v);
        expect(useStore.getState().view).toBe(v);
      }
    });

    it("starts not running", () => {
      expect(useStore.getState().isRunning).toBe(false);
    });

    it("sets running state", () => {
      useStore.getState().setIsRunning(true);
      expect(useStore.getState().isRunning).toBe(true);
      useStore.getState().setIsRunning(false);
      expect(useStore.getState().isRunning).toBe(false);
    });
  });

  describe("partialize (persistence)", () => {
    it("strips apiKey from persisted targets", () => {
      // Access the persist options via the store's internal config
      const persistOptions = (useStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      const target = makeTarget({ apiKey: "sk-secret", apiKeyId: "kid-1", apiKeyLabel: "sk-...123" });
      useStore.getState().addTarget(target);

      const state = useStore.getState();
      const partialState = persistOptions.partialize(state) as { targets: Array<Record<string, unknown>> };
      expect(partialState.targets[0]).not.toHaveProperty("apiKey");
      expect(partialState.targets[0].apiKeyId).toBe("kid-1");
      expect(partialState.targets[0].apiKeyLabel).toBe("sk-...123");
    });

    it("strips apiKey from persisted redTeamConfig", () => {
      const persistOptions = (useStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      useStore.getState().setRedTeamConfig(makeTarget({ apiKey: "sk-secret-rt" }));

      const state = useStore.getState();
      const partialState = persistOptions.partialize(state) as { redTeamConfig: Record<string, unknown> };
      expect(partialState.redTeamConfig).not.toHaveProperty("apiKey");
    });

    it("handles null redTeamConfig in partialize", () => {
      const persistOptions = (useStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      const state = useStore.getState();
      const partialState = persistOptions.partialize(state) as { redTeamConfig: unknown };
      expect(partialState.redTeamConfig).toBeNull();
    });

    it("does not persist view or isRunning", () => {
      const persistOptions = (useStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      useStore.getState().setView("results");
      useStore.getState().setIsRunning(true);

      const state = useStore.getState();
      const partialState = persistOptions.partialize(state) as Record<string, unknown>;
      expect(partialState).not.toHaveProperty("view");
      expect(partialState).not.toHaveProperty("isRunning");
    });

    it("does not persist runProgress", () => {
      const persistOptions = (useStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      useStore.getState().setRunProgress({ total: 50, completed: 10, startTime: Date.now() });

      const state = useStore.getState();
      const partialState = persistOptions.partialize(state) as Record<string, unknown>;
      expect(partialState).not.toHaveProperty("runProgress");
    });
  });
});
