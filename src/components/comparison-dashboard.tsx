// INTEGRATION: Add to store.ts: none (uses existing targets, runs, addRun, addResult, completeRun)
// INTEGRATION: Add to types.ts: none (types are local)
// INTEGRATION: Add to page.tsx: import ComparisonDashboard, add view === "comparison" case
// INTEGRATION: Add to sidebar.tsx: add nav item { view: "comparison", icon: GitCompareArrows, label: "Compare" }

"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { generateId } from "@/lib/uuid";
import type {
  AttackCategory,
  AttackResult,
  AttackRun,
  TargetConfig,
} from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTargetKeyFields } from "@/lib/target-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GitCompareArrows,
  Play,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trophy,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComparisonCell {
  payloadId: string;
  payloadName: string;
  category: AttackCategory;
  results: Record<string, AttackResult | null>; // targetId -> result
}

interface TargetSummary {
  targetId: string;
  targetName: string;
  totalPayloads: number;
  breached: number;
  blocked: number;
  errors: number;
  breachRate: number;
  categoryBreachRates: Record<AttackCategory, { breached: number; total: number }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparisonDashboard() {
  const { targets, addRun, addResult, completeRun, setActiveRun, isRunning, setIsRunning } = useStore();

  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<AttackCategory[]>([
    "injection",
    "jailbreak",
    "extraction",
    "bypass",
  ]);
  const [comparisonResults, setComparisonResults] = useState<Map<string, AttackResult[]>>(new Map());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const connectedTargets = targets.filter((t) => t.connected);

  const toggleTarget = (id: string) => {
    setSelectedTargetIds((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 4) return prev; // Max 4
      return [...prev, id];
    });
  };

  const toggleCategory = (cat: AttackCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const canRun = selectedTargetIds.length >= 2 && selectedCategories.length > 0 && !running && !isRunning;

  const runComparison = useCallback(async () => {
    const selectedTargets = targets.filter((t) => selectedTargetIds.includes(t.id));
    if (selectedTargets.length < 2) return;

    setRunning(true);
    setIsRunning(true);
    const newResults = new Map<string, AttackResult[]>();
    const newProgress: Record<string, number> = {};

    for (const target of selectedTargets) {
      newProgress[target.id] = 0;
    }
    setProgress({ ...newProgress });

    // Run attacks against each target sequentially
    for (const target of selectedTargets) {
      const runId = generateId();
      const run: AttackRun = {
        id: runId,
        targetId: target.id,
        targetName: target.name,
        categories: selectedCategories,
        results: [],
        startTime: Date.now(),
        status: "running",
      };
      addRun(run);

      try {
        const res = await fetch("/api/attack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: target.endpoint,
            ...getTargetKeyFields(target),
            model: target.model,
            provider: target.provider,
            categories: selectedCategories,
          }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const targetResults: AttackResult[] = [];

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
                targetResults.push(result);
                addResult(runId, result);
                newProgress[target.id] = targetResults.length;
                setProgress({ ...newProgress });
              } catch {
                // skip malformed
              }
            }
          }
        }

        newResults.set(target.id, targetResults);
      } catch (err) {
        console.error(`Comparison run failed for ${target.name}:`, err);
        newResults.set(target.id, []);
      } finally {
        completeRun(runId);
      }
    }

    setComparisonResults(new Map(newResults));
    setRunning(false);
    setIsRunning(false);
  }, [targets, selectedTargetIds, selectedCategories, addRun, addResult, completeRun, setIsRunning]);

  // Build comparison matrix
  const buildMatrix = (): ComparisonCell[] => {
    const payloadMap = new Map<string, ComparisonCell>();

    for (const [targetId, results] of comparisonResults) {
      for (const result of results) {
        if (!payloadMap.has(result.payloadId)) {
          payloadMap.set(result.payloadId, {
            payloadId: result.payloadId,
            payloadName: result.payloadName,
            category: result.category,
            results: {},
          });
        }
        payloadMap.get(result.payloadId)!.results[targetId] = result;
      }
    }

    return Array.from(payloadMap.values()).sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.payloadName.localeCompare(b.payloadName);
    });
  };

  const buildSummaries = (): TargetSummary[] => {
    return selectedTargetIds.map((targetId) => {
      const results = comparisonResults.get(targetId) || [];
      const target = targets.find((t) => t.id === targetId);
      const breached = results.filter((r) => r.success).length;
      const blocked = results.filter((r) => !r.success && r.status !== "error").length;
      const errors = results.filter((r) => r.status === "error").length;

      const categoryBreachRates = {} as Record<AttackCategory, { breached: number; total: number }>;
      for (const cat of ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"] as AttackCategory[]) {
        const catResults = results.filter((r) => r.category === cat);
        categoryBreachRates[cat] = {
          breached: catResults.filter((r) => r.success).length,
          total: catResults.length,
        };
      }

      return {
        targetId,
        targetName: target?.name || "Unknown",
        totalPayloads: results.length,
        breached,
        blocked,
        errors,
        breachRate: results.length > 0 ? breached / results.length : 0,
        categoryBreachRates,
      };
    });
  };

  const matrix = comparisonResults.size > 0 ? buildMatrix() : [];
  const summaries = comparisonResults.size > 0 ? buildSummaries() : [];

  const mostVulnerable = summaries.length > 0
    ? summaries.reduce((a, b) => (a.breachRate > b.breachRate ? a : b))
    : null;
  const mostHardened = summaries.length > 0
    ? summaries.reduce((a, b) => (a.breachRate < b.breachRate ? a : b))
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <GitCompareArrows className="h-6 w-6 text-lobster" />
        <h2 className="text-2xl font-bold text-foreground">Multi-Target Comparison</h2>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Target Selection */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Select Targets (2-4)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connectedTargets.length < 2 ? (
              <p className="text-sm text-muted-foreground italic">
                Connect at least 2 targets to use comparison mode.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {connectedTargets.map((target) => (
                  <label
                    key={target.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedTargetIds.includes(target.id)}
                      onCheckedChange={() => toggleTarget(target.id)}
                      disabled={
                        !selectedTargetIds.includes(target.id) && selectedTargetIds.length >= 4
                      }
                      className="border-muted-foreground data-[state=checked]:border-lobster data-[state=checked]:bg-lobster"
                    />
                    <span>{target.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {target.model}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Selection */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Attack Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {(["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"] as AttackCategory[]).map((cat) => (
                <label
                  key={cat}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                    className="border-muted-foreground data-[state=checked]:border-redpincer data-[state=checked]:bg-redpincer"
                  />
                  <span>{CATEGORY_LABELS[cat]}</span>
                </label>
              ))}
            </div>
            <Button
              className="mt-4 w-full gap-2 bg-lobster font-semibold text-white hover:bg-lobster/90 disabled:opacity-40"
              disabled={!canRun}
              onClick={runComparison}
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Comparison...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Comparison
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {running && (
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              {selectedTargetIds.map((tid) => {
                const target = targets.find((t) => t.id === tid);
                return (
                  <div key={tid} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm text-muted-foreground">
                      {target?.name}
                    </span>
                    <Progress value={progress[tid] || 0} className="flex-1" />
                    <span className="text-xs text-muted-foreground">
                      {progress[tid] || 0} results
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Highlights */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {mostVulnerable && (
            <Card className="border-redpincer/30 bg-card">
              <CardContent className="flex items-center gap-3 pt-4">
                <ShieldAlert className="h-8 w-8 text-redpincer" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-redpincer">
                    Most Vulnerable
                  </p>
                  <p className="text-lg font-bold text-foreground">{mostVulnerable.targetName}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(mostVulnerable.breachRate * 100)}% breach rate ({mostVulnerable.breached}/{mostVulnerable.totalPayloads})
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {mostHardened && (
            <Card className="border-success/30 bg-card">
              <CardContent className="flex items-center gap-3 pt-4">
                <ShieldCheck className="h-8 w-8 text-success" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-success">
                    Most Hardened
                  </p>
                  <p className="text-lg font-bold text-foreground">{mostHardened.targetName}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(mostHardened.breachRate * 100)}% breach rate ({mostHardened.breached}/{mostHardened.totalPayloads})
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaries.map((summary) => (
            <Card key={summary.targetId} className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{summary.targetName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {Math.round(summary.breachRate * 100)}%
                  </span>
                  <span className="text-sm text-muted-foreground">breach rate</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline" className="border-redpincer/50 text-redpincer">
                    {summary.breached} breached
                  </Badge>
                  <Badge variant="outline" className="border-success/50 text-success">
                    {summary.blocked} blocked
                  </Badge>
                </div>
                {/* Per-category bars */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {(["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"] as AttackCategory[]).map((cat) => {
                    const catData = summary.categoryBreachRates[cat];
                    if (!catData || catData.total === 0) return null;
                    const pct = Math.round((catData.breached / catData.total) * 100);
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="w-16 truncate text-xs text-muted-foreground">
                          {CATEGORY_LABELS[cat].slice(0, 8)}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct > 60 ? "hsl(var(--redpincer))" : pct > 30 ? "hsl(var(--warning))" : "hsl(var(--success))",
                            }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Comparison Matrix */}
      {matrix.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Shield className="h-4 w-4" />
              Comparison Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Payload</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Category</th>
                    {selectedTargetIds.map((tid) => {
                      const target = targets.find((t) => t.id === tid);
                      return (
                        <th key={tid} className="px-3 py-2 text-center font-semibold text-muted-foreground">
                          {target?.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((cell) => (
                    <tr key={cell.payloadId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-foreground">{cell.payloadName}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[cell.category]}
                        </Badge>
                      </td>
                      {selectedTargetIds.map((tid) => {
                        const result = cell.results[tid];
                        if (!result) {
                          return (
                            <td key={tid} className="px-3 py-1.5 text-center">
                              <span className="text-xs text-muted-foreground">--</span>
                            </td>
                          );
                        }
                        return (
                          <td key={tid} className="px-3 py-1.5 text-center">
                            <Badge
                              variant="outline"
                              className={
                                result.success
                                  ? "border-redpincer/50 bg-redpincer/10 text-redpincer"
                                  : "border-success/50 bg-success/10 text-success"
                              }
                            >
                              {result.success ? "BREACHED" : "BLOCKED"}
                            </Badge>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Summary Row */}
                  <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                    <td className="px-3 py-2 text-foreground" colSpan={2}>
                      Total Breached
                    </td>
                    {summaries.map((summary) => (
                      <td key={summary.targetId} className="px-3 py-2 text-center text-redpincer">
                        {summary.breached} / {summary.totalPayloads}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {comparisonResults.size === 0 && !running && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <GitCompareArrows className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              Select 2-4 targets and run a comparison to see side-by-side results.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
