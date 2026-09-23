import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  TargetConfig,
  AttackCategory,
  AttackRun,
  AttackResult,
  Assessment,
  Finding,
} from "./types";
import { generateId } from "./uuid";
import { generateFindingsFromResults, calculateAssessmentSummary } from "./findings";

export type ViewName =
  | "dashboard"
  | "config"
  | "assessments"
  | "findings"
  | "attacks"
  | "results"
  | "reports"
  | "chains"
  | "session"
  | "editor"
  | "comparison"
  | "adaptive"
  | "evolve"
  | "heatmap"
  | "regression"
  | "scoring"
  | "settings"
  | "about";

interface AppState {
  // Targets
  targets: TargetConfig[];
  activeTargetId: string | null;
  addTarget: (target: TargetConfig) => void;
  updateTarget: (id: string, updates: Partial<TargetConfig>) => void;
  removeTarget: (id: string) => void;
  duplicateTarget: (id: string) => void;
  setActiveTarget: (id: string | null) => void;

  // Assessments
  assessments: Assessment[];
  activeAssessmentId: string | null;
  addAssessment: (assessment: Assessment) => void;
  updateAssessment: (id: string, updates: Partial<Assessment>) => void;
  deleteAssessment: (id: string) => void;
  duplicateAssessment: (id: string) => void;
  setActiveAssessment: (id: string | null) => void;

  // Findings
  findings: Finding[];
  addFinding: (finding: Finding) => void;
  updateFinding: (id: string, updates: Partial<Finding>) => void;
  deleteFinding: (id: string) => void;
  generateFindingsForAssessment: (assessmentId: string) => void;

  // Attack selection
  selectedCategories: AttackCategory[];
  toggleCategory: (category: AttackCategory) => void;
  setCategories: (categories: AttackCategory[]) => void;

  // Attack runs
  runs: AttackRun[];
  activeRunId: string | null;
  addRun: (run: AttackRun) => void;
  addResult: (runId: string, result: AttackResult) => void;
  completeRun: (runId: string) => void;
  cancelRun: (runId: string) => void;
  setActiveRun: (id: string | null) => void;
  deleteRun: (runId: string) => void;

  // Run settings
  concurrency: number;
  setConcurrency: (n: number) => void;

  // Run progress (not persisted)
  runProgress: { total: number; completed: number; startTime: number } | null;
  setRunProgress: (progress: { total: number; completed: number; startTime: number } | null) => void;
  incrementRunProgress: () => void;

  // Red Team LLM (used for AI-powered features instead of target)
  redTeamConfig: TargetConfig | null;
  setRedTeamConfig: (config: TargetConfig | null) => void;
  updateRedTeamConfig: (updates: Partial<TargetConfig>) => void;

  // UI state (not persisted)
  view: ViewName;
  setView: (view: ViewName) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  cancelActiveExecution: (() => void) | null;
  setCancelActiveExecution: (fn: (() => void) | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Targets
      targets: [],
      activeTargetId: null,
      addTarget: (target) =>
        set((state) => ({
          targets: [...state.targets, target],
        })),
      updateTarget: (id, updates) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      removeTarget: (id) =>
        set((state) => ({
          targets: state.targets.filter((t) => t.id !== id),
          activeTargetId:
            state.activeTargetId === id ? null : state.activeTargetId,
        })),
      duplicateTarget: (id) =>
        set((state) => {
          const target = state.targets.find((t) => t.id === id);
          if (!target) return state;
          const newTarget: TargetConfig = {
            ...target,
            id: generateId(),
            name: `${target.name} (Copy)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return {
            targets: [...state.targets, newTarget],
            activeTargetId: newTarget.id,
          };
        }),
      setActiveTarget: (id) => set({ activeTargetId: id }),

      // Assessments
      assessments: [],
      activeAssessmentId: null,
      addAssessment: (assessment) =>
        set((state) => ({
          assessments: [assessment, ...state.assessments],
          activeAssessmentId: assessment.id,
        })),
      updateAssessment: (id, updates) =>
        set((state) => ({
          assessments: state.assessments.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
          ),
        })),
      deleteAssessment: (id) =>
        set((state) => ({
          assessments: state.assessments.filter((a) => a.id !== id),
          activeAssessmentId:
            state.activeAssessmentId === id ? null : state.activeAssessmentId,
          findings: state.findings.filter((f) => f.assessmentId !== id),
        })),
      duplicateAssessment: (id) =>
        set((state) => {
          const existing = state.assessments.find((a) => a.id === id);
          if (!existing) return state;
          const duplicated: Assessment = {
            ...existing,
            id: generateId(),
            name: `${existing.name} (Copy)`,
            status: "draft",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            startedAt: undefined,
            completedAt: undefined,
            runIds: [],
            summary: undefined,
          };
          return {
            assessments: [duplicated, ...state.assessments],
            activeAssessmentId: duplicated.id,
          };
        }),
      setActiveAssessment: (id) => set({ activeAssessmentId: id }),

      // Findings
      findings: [],
      addFinding: (finding) =>
        set((state) => ({
          findings: [finding, ...state.findings],
        })),
      updateFinding: (id, updates) =>
        set((state) => ({
          findings: state.findings.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
          ),
        })),
      deleteFinding: (id) =>
        set((state) => ({
          findings: state.findings.filter((f) => f.id !== id),
        })),
      generateFindingsForAssessment: (assessmentId) =>
        set((state) => {
          const assessment = state.assessments.find((a) => a.id === assessmentId);
          if (!assessment) return state;

          const linkedRuns = state.runs.filter((r) =>
            assessment.runIds.includes(r.id)
          );
          const allResults = linkedRuns.flatMap((r) => r.results);

          const derivedFindings = generateFindingsFromResults(
            assessment.id,
            assessment.targetId,
            allResults
          );

          // Retain findings from other assessments, replace for this assessment
          const otherFindings = state.findings.filter(
            (f) => f.assessmentId !== assessmentId
          );
          const updatedFindings = [...derivedFindings, ...otherFindings];

          // Compute quantitative summary
          const summary = calculateAssessmentSummary(
            assessment,
            state.runs,
            derivedFindings
          );

          const updatedAssessments = state.assessments.map((a) =>
            a.id === assessmentId
              ? { ...a, summary, updatedAt: Date.now() }
              : a
          );

          return {
            findings: updatedFindings,
            assessments: updatedAssessments,
          };
        }),

      // Attack selection
      selectedCategories: ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"],
      toggleCategory: (category) =>
        set((state) => ({
          selectedCategories: state.selectedCategories.includes(category)
            ? state.selectedCategories.filter((c) => c !== category)
            : [...state.selectedCategories, category],
        })),
      setCategories: (categories) => set({ selectedCategories: categories }),

      // Attack runs
      runs: [],
      activeRunId: null,
      addRun: (run) => set((state) => ({ runs: [run, ...state.runs] })),
      addResult: (runId, result) =>
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === runId ? { ...r, results: [...r.results, result] } : r
          ),
        })),
      completeRun: (runId) =>
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === runId
              ? { ...r, status: "completed" as const, endTime: Date.now() }
              : r
          ),
        })),
      cancelRun: (runId) =>
        set((state) => ({
          runs: state.runs.map((r) =>
            r.id === runId
              ? { ...r, status: "cancelled" as const, endTime: Date.now() }
              : r
          ),
          isRunning: false,
          runProgress: null,
        })),
      setActiveRun: (id) => set({ activeRunId: id }),
      deleteRun: (runId) =>
        set((state) => ({
          runs: state.runs.filter((r) => r.id !== runId),
          activeRunId:
            state.activeRunId === runId ? null : state.activeRunId,
        })),

      // Run settings
      concurrency: 1,
      setConcurrency: (n) => set({ concurrency: Math.max(1, Math.min(10, n)) }),

      // Run progress
      runProgress: null,
      setRunProgress: (progress) => set({ runProgress: progress }),
      incrementRunProgress: () =>
        set((state) => ({
          runProgress: state.runProgress
            ? {
                ...state.runProgress,
                completed: Math.min(
                  state.runProgress.total,
                  state.runProgress.completed + 1
                ),
              }
            : null,
        })),

      // Red Team LLM
      redTeamConfig: null,
      setRedTeamConfig: (config) => set({ redTeamConfig: config }),
      updateRedTeamConfig: (updates) =>
        set((state) => ({
          redTeamConfig: state.redTeamConfig
            ? { ...state.redTeamConfig, ...updates }
            : null,
        })),

      // UI state
      view: "dashboard",
      setView: (view) => set({ view }),
      isRunning: false,
      setIsRunning: (running) => set({ isRunning: running }),
      cancelActiveExecution: null,
      setCancelActiveExecution: (fn) => set({ cancelActiveExecution: fn }),
    }),
    {
      name: "centauri-aegis-state",
      storage: createJSONStorage(() => ({
        getItem: (name: string): string | null => {
          if (typeof window === "undefined") return null;
          const current = localStorage.getItem(name);
          if (current) return current;
          // Legacy compatibility only — do not use for new deployments.
          const legacy = localStorage.getItem("redpincer-state");
          if (legacy) {
            try {
              localStorage.setItem(name, legacy);
              return legacy;
            } catch {
              return legacy;
            }
          }
          return null;
        },
        setItem: (name: string, value: string): void => {
          if (typeof window !== "undefined") {
            localStorage.setItem(name, value);
          }
        },
        removeItem: (name: string): void => {
          if (typeof window !== "undefined") {
            localStorage.removeItem(name);
          }
        },
      })),
      partialize: (state) => ({
        // Strip plaintext apiKey from persisted targets — only persist apiKeyId + apiKeyLabel
        targets: state.targets.map((t) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { apiKey: _key, ...safe } = t;
          return safe;
        }),
        redTeamConfig: state.redTeamConfig
          ? (() => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { apiKey: _k, ...safe } = state.redTeamConfig;
              return safe;
            })()
          : null,
        activeTargetId: state.activeTargetId,
        assessments: state.assessments,
        activeAssessmentId: state.activeAssessmentId,
        findings: state.findings,
        selectedCategories: state.selectedCategories,
        runs: state.runs,
        activeRunId: state.activeRunId,
        concurrency: state.concurrency,
      }),
    }
  )
);
