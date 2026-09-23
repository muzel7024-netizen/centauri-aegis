// INTEGRATION: Add to store.ts: none (uses existing runs, targets, addRun, addResult, completeRun)
// INTEGRATION: Add to types.ts: none (types are local + Baseline stored in localStorage)
// INTEGRATION: Add to page.tsx: import RegressionRunner, add view === "regression" case
// INTEGRATION: Add to sidebar.tsx: add nav item { view: "regression", icon: GitBranch, label: "Regression" }

"use client";

import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { generateId } from "@/lib/uuid";
import type { AttackResult, AttackRun, AttackCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { getTargetKeyFields } from "@/lib/target-utils";
import {
  GitBranch,
  Save,
  Play,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Target,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BaselineEntry {
  payloadId: string;
  payloadName: string;
  category: AttackCategory;
  success: boolean;
  classification: string;
  severityScore: number;
}

interface Baseline {
  id: string;
  name: string;
  targetId: string;
  targetName: string;
  sourceRunId: string;
  createdAt: number;
  entries: BaselineEntry[];
}

type ComparisonStatus = "still_vulnerable" | "fixed" | "new_vulnerability" | "still_safe";

interface RegressionComparison {
  payloadId: string;
  payloadName: string;
  category: AttackCategory;
  baselineSuccess: boolean;
  currentSuccess: boolean;
  status: ComparisonStatus;
  baselineClassification: string;
  currentClassification: string;
}

interface RegressionRun {
  id: string;
  baselineId: string;
  targetName: string;
  timestamp: number;
  comparisons: RegressionComparison[];
  fixCount: number;
  regressionCount: number;
  score: number; // % of fixes
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const BASELINES_KEY = "centauri-aegis-baselines";
const REGRESSION_RUNS_KEY = "centauri-aegis-regression-runs";

function loadBaselines(): Baseline[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BASELINES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBaselines(baselines: Baseline[]): void {
  localStorage.setItem(BASELINES_KEY, JSON.stringify(baselines));
}

function loadRegressionRuns(): RegressionRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REGRESSION_RUNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegressionRuns(runs: RegressionRun[]): void {
  localStorage.setItem(REGRESSION_RUNS_KEY, JSON.stringify(runs));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ComparisonStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  still_vulnerable: { label: "Still Vulnerable", color: "text-destructive border-destructive/50", icon: XCircle },
  fixed: { label: "Fixed", color: "text-success border-success/50", icon: CheckCircle2 },
  new_vulnerability: { label: "New Vulnerability", color: "text-warning border-warning/50", icon: AlertTriangle },
  still_safe: { label: "Still Safe", color: "text-muted-foreground border-border", icon: ShieldCheck },
};

export function RegressionRunner() {
  const { runs, targets, activeRunId, addRun, addResult, completeRun, isRunning, setIsRunning } =
    useStore();

  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [regressionRuns, setRegressionRuns] = useState<RegressionRun[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setBaselines(loadBaselines());
    setRegressionRuns(loadRegressionRuns());
  }, []);

  const completedRuns = runs.filter((r) => r.status === "completed" && r.results.length > 0);
  const activeRun = runs.find((r) => r.id === activeRunId);
  const connectedTargets = targets.filter((t) => t.connected);
  const selectedBaseline = baselines.find((b) => b.id === selectedBaselineId) || null;

  // Save current run as baseline
  const saveAsBaseline = (run: AttackRun) => {
    const successfulEntries: BaselineEntry[] = run.results.map((r) => ({
      payloadId: r.payloadId,
      payloadName: r.payloadName,
      category: r.category,
      success: r.success,
      classification: r.analysis.classification,
      severityScore: r.analysis.severityScore,
    }));

    const baseline: Baseline = {
      id: generateId(),
      name: `${run.targetName} - ${new Date(run.startTime).toLocaleDateString()}`,
      targetId: run.targetId,
      targetName: run.targetName,
      sourceRunId: run.id,
      createdAt: Date.now(),
      entries: successfulEntries,
    };

    const updated = [...baselines, baseline];
    setBaselines(updated);
    saveBaselines(updated);
  };

  const deleteBaseline = (id: string) => {
    const updated = baselines.filter((b) => b.id !== id);
    setBaselines(updated);
    saveBaselines(updated);
    if (selectedBaselineId === id) setSelectedBaselineId(null);
  };

  // Run regression test
  const runRegression = async () => {
    if (!selectedBaseline) return;

    const targetId = selectedTargetId || selectedBaseline.targetId;
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;

    setRunning(true);
    setIsRunning(true);
    setProgress(0);

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: [...new Set(selectedBaseline.entries.map((e) => e.category))],
      results: [],
      startTime: Date.now(),
      status: "running",
    };
    addRun(run);

    // Get payload IDs from baseline
    const payloadIds = [...new Set(selectedBaseline.entries.map((e) => e.payloadId))];

    try {
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: target.endpoint,
          ...getTargetKeyFields(target),
          model: target.model,
          provider: target.provider,
          payloadIds,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const newResults: AttackResult[] = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            try {
              const result: AttackResult = JSON.parse(line);
              newResults.push(result);
              addResult(runId, result);
              setProgress(Math.round((newResults.length / payloadIds.length) * 100));
            } catch {
              // skip
            }
          }
        }
      }

      // Build comparison
      const comparisons: RegressionComparison[] = [];
      for (const entry of selectedBaseline.entries) {
        const currentResult = newResults.find((r) => r.payloadId === entry.payloadId);
        const currentSuccess = currentResult?.success || false;
        const currentClassification = currentResult?.analysis?.classification || "error";

        let status: ComparisonStatus;
        if (entry.success && currentSuccess) {
          status = "still_vulnerable";
        } else if (entry.success && !currentSuccess) {
          status = "fixed";
        } else if (!entry.success && currentSuccess) {
          status = "new_vulnerability";
        } else {
          status = "still_safe";
        }

        comparisons.push({
          payloadId: entry.payloadId,
          payloadName: entry.payloadName,
          category: entry.category,
          baselineSuccess: entry.success,
          currentSuccess,
          status,
          baselineClassification: entry.classification,
          currentClassification,
        });
      }

      const fixCount = comparisons.filter((c) => c.status === "fixed").length;
      const regressionCount = comparisons.filter((c) => c.status === "new_vulnerability").length;
      const totalChanges = fixCount + regressionCount;
      const score = totalChanges > 0 ? Math.round((fixCount / totalChanges) * 100) : 100;

      const regressionRun: RegressionRun = {
        id: generateId(),
        baselineId: selectedBaseline.id,
        targetName: target.name,
        timestamp: Date.now(),
        comparisons,
        fixCount,
        regressionCount,
        score,
      };

      const updatedRuns = [regressionRun, ...regressionRuns];
      setRegressionRuns(updatedRuns);
      saveRegressionRuns(updatedRuns);
    } catch (err) {
      console.error("Regression run failed:", err);
    } finally {
      completeRun(runId);
      setRunning(false);
      setIsRunning(false);
    }
  };

  // Filter regression runs for selected baseline
  const baselineRegressionRuns = selectedBaseline
    ? regressionRuns.filter((r) => r.baselineId === selectedBaseline.id)
    : [];

  const latestRegression = baselineRegressionRuns.length > 0 ? baselineRegressionRuns[0] : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">Attack Replay & Regression</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Save Baseline */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Save Baseline from Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No completed runs to save as baseline.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {completedRuns.slice(0, 5).map((run) => {
                  const breached = run.results.filter((r) => r.success).length;
                  const alreadySaved = baselines.some((b) => b.sourceRunId === run.id);
                  return (
                    <div
                      key={run.id}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="font-medium text-foreground">{run.targetName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {breached}/{run.results.length} breached
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        disabled={alreadySaved}
                        onClick={() => saveAsBaseline(run)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        {alreadySaved ? "Saved" : "Save Baseline"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Baselines List */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Saved Baselines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {baselines.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No baselines saved yet. Save a completed run as a baseline.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {baselines.map((baseline) => (
                  <div
                    key={baseline.id}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted cursor-pointer ${
                      selectedBaselineId === baseline.id ? "bg-muted ring-1 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedBaselineId(baseline.id)}
                  >
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <span className="font-medium text-foreground">{baseline.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {baseline.entries.length} payloads |{" "}
                        {baseline.entries.filter((e) => e.success).length} breached |{" "}
                        {new Date(baseline.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBaseline(baseline.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Run Regression */}
      {selectedBaseline && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">
              Run Regression Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Baseline: <span className="text-foreground font-medium">{selectedBaseline.name}</span> |{" "}
              {selectedBaseline.entries.length} payloads
            </p>

            {/* Target selection */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Run against target:
              </p>
              <div className="flex flex-wrap gap-2">
                {connectedTargets.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => setSelectedTargetId(target.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      (selectedTargetId || selectedBaseline.targetId) === target.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            </div>

            {running && (
              <div className="mb-4">
                <Progress value={progress} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground">{progress}% complete</p>
              </div>
            )}

            <Button
              className="w-full gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              disabled={running || isRunning || connectedTargets.length === 0}
              onClick={runRegression}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Regression...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Regression Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Latest Regression Results */}
      {latestRegression && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Latest Regression Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4 md:grid-cols-4">
              {(
                [
                  "still_vulnerable",
                  "fixed",
                  "new_vulnerability",
                  "still_safe",
                ] as ComparisonStatus[]
              ).map((status) => {
                const config = STATUS_CONFIG[status];
                const count = latestRegression.comparisons.filter(
                  (c) => c.status === status
                ).length;
                const Icon = config.icon;
                return (
                  <div key={status} className="rounded-lg border border-border p-3 text-center">
                    <Icon className={`mx-auto h-5 w-5 ${config.color.split(" ")[0]}`} />
                    <p className="mt-1 text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Regression Score */}
            <div className="mb-4 rounded-lg border border-border p-3 text-center">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Regression Score
              </p>
              <p
                className={`text-3xl font-bold ${
                  latestRegression.score >= 70
                    ? "text-success"
                    : latestRegression.score >= 40
                      ? "text-warning"
                      : "text-destructive"
                }`}
              >
                {latestRegression.score}%
              </p>
              <p className="text-xs text-muted-foreground">
                {latestRegression.fixCount} fixes | {latestRegression.regressionCount} regressions
              </p>
            </div>

            {/* Comparison Table */}
            <ScrollArea className="max-h-[400px]">
              <div className="flex flex-col gap-1">
                {latestRegression.comparisons.map((comp) => {
                  const config = STATUS_CONFIG[comp.status];
                  const Icon = config.icon;
                  return (
                    <div
                      key={comp.payloadId}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/30"
                    >
                      <Icon className={`h-4 w-4 ${config.color.split(" ")[0]}`} />
                      <span className="flex-1 truncate text-foreground">{comp.payloadName}</span>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[comp.category]}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Timeline (multiple regression runs) */}
      {baselineRegressionRuns.length > 1 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Regression Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {baselineRegressionRuns.map((regRun, i) => (
                <div
                  key={regRun.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                    #{baselineRegressionRuns.length - i}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{regRun.targetName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(regRun.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="border-success/50 text-success">
                      {regRun.fixCount} fixed
                    </Badge>
                    <Badge variant="outline" className="border-warning/50 text-warning">
                      {regRun.regressionCount} regressed
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        regRun.score >= 70
                          ? "border-success/50 text-success"
                          : regRun.score >= 40
                            ? "border-warning/50 text-warning"
                            : "border-destructive/50 text-destructive"
                      }
                    >
                      Score: {regRun.score}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!selectedBaseline && baselines.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Save a completed attack run as a baseline, then run regression tests to track changes.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
