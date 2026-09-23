"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import type { AttackCategory, Severity, AttackResult, AttackRun, AnalysisClassification } from "@/lib/types";
import { CATEGORY_LABELS, SEVERITY_ORDER } from "@/lib/types";
import { getTargetKeyFields } from "@/lib/target-utils";
import { generateId } from "@/lib/uuid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getConfigRequestFields } from "@/lib/target-utils";
import {
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Shield,
  Target,
  Sparkles,
  Wand2,
  Copy,
  BookmarkPlus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

const ALL_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
  "tool_abuse",
  "multi_turn",
  "encoding",
];

const ALL_SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

const ALL_CLASSIFICATIONS: AnalysisClassification[] = [
  "full_jailbreak",
  "information_leakage",
  "partial_compliance",
  "refusal",
  "error",
];

type SortField = "name" | "severity" | "classification" | "duration" | "score";
type SortDirection = "asc" | "desc";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const CLASSIFICATION_RANK: Record<AnalysisClassification, number> = {
  full_jailbreak: 5,
  information_leakage: 4,
  partial_compliance: 3,
  refusal: 2,
  error: 1,
};

function severityBadgeClass(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "high":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "medium":
      return "bg-warning/20 text-warning border-warning/30";
    case "low":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
}

function categoryBadgeClass(category: AttackCategory): string {
  switch (category) {
    case "injection":
      return "bg-primary/20 text-primary border-primary/30";
    case "jailbreak":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "extraction":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "bypass":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "tool_abuse":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "multi_turn":
      return "bg-teal-500/20 text-teal-400 border-teal-500/30";
    case "encoding":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function classificationBadgeClass(classification: AnalysisClassification): string {
  switch (classification) {
    case "refusal":
      return "bg-success/20 text-success border-success/30";
    case "partial_compliance":
      return "bg-warning/20 text-warning border-warning/30";
    case "full_jailbreak":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "information_leakage":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "error":
      return "bg-muted/20 text-muted-foreground border-border";
  }
}

function classificationLabel(classification: AnalysisClassification): string {
  switch (classification) {
    case "refusal":
      return "Refusal";
    case "partial_compliance":
      return "Partial Compliance";
    case "full_jailbreak":
      return "Full Jailbreak";
    case "information_leakage":
      return "Information Leakage";
    case "error":
      return "Error";
  }
}

function severityScoreColor(score: number): string {
  if (score <= 2) return "[&>div]:bg-success";
  if (score <= 4) return "[&>div]:bg-blue-500";
  if (score <= 6) return "[&>div]:bg-warning";
  if (score <= 8) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-destructive";
}

function statusIcon(result: AttackResult) {
  if (result.status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (result.success) {
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }
  return <CheckCircle className="h-4 w-4 text-success" />;
}

export function ResultsDashboard() {
  const {
    runs,
    activeRunId,
    targets,
    redTeamConfig,
    addRun,
    addResult,
    completeRun,
    cancelRun,
    setActiveRun,
    isRunning,
    setIsRunning,
    setRunProgress,
    incrementRunProgress,
    concurrency,
  } = useStore();
  const activeRun = runs.find((r) => r.id === activeRunId) ?? runs[0];
  const activeTarget = targets.find((t) => t.id === activeRun?.targetId);

  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClassification, setFilterClassification] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    new Set()
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explaining, setExplaining] = useState<Record<string, boolean>>({});
  const [mutations, setMutations] = useState<
    Record<string, { mutatedPrompt: string; technique: string }>
  >({});
  const [mutating, setMutating] = useState<Record<string, boolean>>({});
  const [retrying, setRetrying] = useState(false);
  const retryAbortRef = useRef<AbortController | null>(null);

  // Count error results (network errors, timeouts, API failures)
  const errorResults = useMemo(
    () => activeRun?.results.filter((r) => r.status === "error") ?? [],
    [activeRun?.results]
  );

  const retryFailedPayloads = useCallback(
    async (mode: "errors" | "all_failed") => {
      if (!activeTarget || !activeRun || retrying || isRunning) return;

      const toRetry =
        mode === "errors"
          ? errorResults
          : activeRun.results.filter(
              (r) => r.status === "error" || r.status === "fail"
            );

      if (toRetry.length === 0) return;

      // Deduplicate by payloadId (in case same payload errored multiple times)
      const uniquePayloadIds = [...new Set(toRetry.map((r) => r.payloadId))];
      const categories = [
        ...new Set(toRetry.map((r) => r.category)),
      ] as AttackCategory[];

      const controller = new AbortController();
      retryAbortRef.current = controller;

      const runId = generateId();
      const run: AttackRun = {
        id: runId,
        targetId: activeTarget.id,
        targetName: activeTarget.name,
        categories,
        results: [],
        startTime: Date.now(),
        status: "running",
      };

      addRun(run);
      setActiveRun(runId);
      setRetrying(true);
      setIsRunning(true);
      setRunProgress({
        total: uniquePayloadIds.length,
        completed: 0,
        startTime: Date.now(),
      });

      try {
        const res = await fetch("/api/attack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: activeTarget.endpoint,
            ...getTargetKeyFields(activeTarget),
            model: activeTarget.model,
            provider: activeTarget.provider,
            payloadIds: uniquePayloadIds,
            concurrency,
          }),
          signal: controller.signal,
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (
                  parsed.type === "meta" &&
                  typeof parsed.totalPayloads === "number"
                ) {
                  setRunProgress({
                    total: parsed.totalPayloads,
                    completed: 0,
                    startTime: Date.now(),
                  });
                } else {
                  addResult(runId, parsed);
                  incrementRunProgress();
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          cancelRun(runId);
          setRetrying(false);
          setIsRunning(false);
          setRunProgress(null);
          retryAbortRef.current = null;
          return;
        }
        console.error("Retry run failed:", err);
      }

      completeRun(runId);
      setRetrying(false);
      setIsRunning(false);
      setRunProgress(null);
      retryAbortRef.current = null;
    },
    [
      activeTarget,
      activeRun,
      retrying,
      isRunning,
      errorResults,
      concurrency,
      addRun,
      addResult,
      completeRun,
      cancelRun,
      setActiveRun,
      setIsRunning,
      setRunProgress,
      incrementRunProgress,
    ]
  );

  // Single-payload retry — reruns one specific payload within the current run
  const [retryingSingle, setRetryingSingle] = useState<Record<string, boolean>>({});

  const retrySinglePayload = useCallback(
    async (result: AttackResult) => {
      if (!activeTarget || !activeRun || isRunning || retryingSingle[result.id]) return;

      setRetryingSingle((prev) => ({ ...prev, [result.id]: true }));

      try {
        const res = await fetch("/api/attack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: activeTarget.endpoint,
            ...getTargetKeyFields(activeTarget),
            model: activeTarget.model,
            provider: activeTarget.provider,
            payloadIds: [result.payloadId],
            concurrency: 1,
          }),
        });

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.type !== "meta") {
                  addResult(activeRun.id, parsed);
                }
              } catch {
                // skip malformed
              }
            }
          }
        }
      } catch (err) {
        console.error("Single retry failed:", err);
      } finally {
        setRetryingSingle((prev) => ({ ...prev, [result.id]: false }));
      }
    },
    [activeTarget, activeRun, isRunning, retryingSingle, addResult]
  );

  const explainBreach = useCallback(
    async (result: AttackResult) => {
      if (!redTeamConfig || explaining[result.id]) return;
      setExplaining((prev) => ({ ...prev, [result.id]: true }));
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...getConfigRequestFields(redTeamConfig),
            prompt: result.prompt,
            response: result.response,
            classification: result.analysis.classification,
            category: result.category,
          }),
        });
        const data = await res.json();
        if (data.explanation) {
          setExplanations((prev) => ({ ...prev, [result.id]: data.explanation }));
        }
      } catch {
        // silently fail
      } finally {
        setExplaining((prev) => ({ ...prev, [result.id]: false }));
      }
    },
    [redTeamConfig, explaining]
  );

  const mutatePayload = useCallback(
    async (result: AttackResult) => {
      if (!redTeamConfig || mutating[result.id]) return;
      setMutating((prev) => ({ ...prev, [result.id]: true }));
      try {
        const res = await fetch("/api/mutate-payload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...getConfigRequestFields(redTeamConfig),
            originalPrompt: result.prompt,
            category: result.category,
          }),
        });
        const data = await res.json();
        if (data.mutatedPrompt) {
          setMutations((prev) => ({
            ...prev,
            [result.id]: { mutatedPrompt: data.mutatedPrompt, technique: data.technique },
          }));
        }
      } catch {
        // silently fail
      } finally {
        setMutating((prev) => ({ ...prev, [result.id]: false }));
      }
    },
    [redTeamConfig, mutating]
  );

  const saveMutationToEditor = useCallback(
    (result: AttackResult, mutatedPrompt: string) => {
      const existing = JSON.parse(
        localStorage.getItem("centauri-aegis-custom-payloads") || "[]"
      );
      const newPayload = {
        id: `custom-${Date.now()}`,
        name: `[Mutated] ${result.payloadName}`,
        description: `AI-mutated variant of "${result.payloadName}"`,
        category: result.category,
        severity: result.severity,
        prompt: mutatedPrompt,
        tags: ["ai-generated", "mutated"],
      };
      localStorage.setItem(
        "centauri-aegis-custom-payloads",
        JSON.stringify([...existing, newPayload])
      );
    },
    []
  );

  const results = activeRun?.results ?? [];

  const filteredResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let filtered = results.filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory)
        return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity)
        return false;
      if (filterStatus === "success" && !r.success) return false;
      if (filterStatus === "fail" && r.success) return false;
      if (filterClassification !== "all" && r.analysis?.classification !== filterClassification)
        return false;
      if (query) {
        const matchesName = r.payloadName.toLowerCase().includes(query);
        const matchesId = r.payloadId?.toLowerCase().includes(query);
        const matchesResponse = r.response?.toLowerCase().includes(query);
        const matchesPrompt = r.prompt?.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesResponse && !matchesPrompt)
          return false;
      }
      return true;
    });

    if (sortField) {
      const dir = sortDirection === "asc" ? 1 : -1;
      filtered = [...filtered].sort((a, b) => {
        switch (sortField) {
          case "name":
            return dir * a.payloadName.localeCompare(b.payloadName);
          case "severity":
            return dir * ((SEVERITY_RANK[a.severity] ?? 0) - (SEVERITY_RANK[b.severity] ?? 0));
          case "classification":
            return dir * (
              (CLASSIFICATION_RANK[a.analysis?.classification ?? "error"] ?? 0) -
              (CLASSIFICATION_RANK[b.analysis?.classification ?? "error"] ?? 0)
            );
          case "duration":
            return dir * ((a.durationMs ?? 0) - (b.durationMs ?? 0));
          case "score":
            return dir * (
              (a.analysis?.severityScore ?? 0) - (b.analysis?.severityScore ?? 0)
            );
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [results, filterCategory, filterSeverity, filterStatus, filterClassification, searchQuery, sortField, sortDirection]);

  const totalAttacks = results.length;
  const successfulAttacks = results.filter((r) => r.success).length;
  const failedAttacks = results.filter(
    (r) => !r.success && r.status !== "running"
  ).length;
  const runningAttacks = results.filter((r) => r.status === "running").length;
  const successRate =
    totalAttacks > 0 ? Math.round((successfulAttacks / totalAttacks) * 100) : 0;

  const toggleExpand = (id: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }, [sortField, sortDirection]);

  const expandAll = useCallback(() => {
    setExpandedResults(new Set(filteredResults.map((r) => r.id)));
  }, [filteredResults]);

  const collapseAll = useCallback(() => {
    setExpandedResults(new Set());
  }, []);

  const hasActiveFilters =
    filterCategory !== "all" ||
    filterSeverity !== "all" ||
    filterStatus !== "all" ||
    filterClassification !== "all" ||
    searchQuery !== "" ||
    sortField !== null;

  const clearAllFilters = useCallback(() => {
    setFilterCategory("all");
    setFilterSeverity("all");
    setFilterStatus("all");
    setFilterClassification("all");
    setSearchQuery("");
    setSortField(null);
  }, []);

  function sortIcon(field: SortField) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3" />;
    return sortDirection === "desc" ? (
      <ArrowDown className="h-3 w-3" />
    ) : (
      <ArrowUp className="h-3 w-3" />
    );
  }

  // Per-category stats
  const categoryStats = ALL_CATEGORIES.map((cat) => {
    const catResults = results.filter((r) => r.category === cat);
    const catSuccess = catResults.filter((r) => r.success).length;
    return {
      category: cat,
      total: catResults.length,
      success: catSuccess,
      rate: catResults.length > 0 ? (catSuccess / catResults.length) * 100 : 0,
    };
  });

  // Severity stats
  const severityStats = ALL_SEVERITIES.map((sev) => {
    const sevResults = results.filter((r) => r.severity === sev);
    const sevSuccess = sevResults.filter((r) => r.success).length;
    return {
      severity: sev,
      total: sevResults.length,
      success: sevSuccess,
    };
  });

  if (!activeRun) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
        <BarChart3 className="h-16 w-16 opacity-30" />
        <p className="text-lg">No attack runs yet</p>
        <p className="text-sm">
          Configure a target and run attacks to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <BarChart3 className="h-6 w-6 text-primary" />
            Results Dashboard
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Target: <span className="text-foreground">{activeRun.targetName}</span>{" "}
            &middot; Status:{" "}
            <span
              className={
                activeRun.status === "running" ? "text-warning" : "text-success"
              }
            >
              {activeRun.status}
            </span>
            {activeRun.status === "running" && (
              <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />
            )}
          </p>
        </div>

        {/* Retry buttons — shown when run is complete and has failures */}
        {activeRun.status !== "running" && !isRunning && (
          <div className="flex shrink-0 items-center gap-2">
            {errorResults.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryFailedPayloads("errors")}
                disabled={retrying}
                className="border-warning/30 text-warning hover:bg-warning/10"
              >
                {retrying ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Retry Errors ({errorResults.length})
              </Button>
            )}
            {results.some((r) => !r.success && r.status !== "running") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryFailedPayloads("all_failed")}
                disabled={retrying}
                className="border-muted-foreground/30 text-muted-foreground hover:bg-muted/30"
              >
                {retrying ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Retry All Failed (
                {
                  results.filter(
                    (r) => !r.success && r.status !== "running"
                  ).length
                }
                )
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Attacks
            </p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {totalAttacks}
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/30 bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-destructive">
              Successful (Vulnerable)
            </p>
            <p className="mt-1 text-3xl font-bold text-destructive">
              {successfulAttacks}
            </p>
            <p className="text-xs text-muted-foreground">{successRate}%</p>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-success">
              Blocked (Safe)
            </p>
            <p className="mt-1 text-3xl font-bold text-success">
              {failedAttacks}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Running
            </p>
            <p className="mt-1 text-3xl font-bold text-warning">
              {runningAttacks}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category & Severity Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              By Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryStats.map((stat) => (
              <div key={stat.category}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {CATEGORY_LABELS[stat.category]}
                  </span>
                  <span className="font-mono text-foreground">
                    {stat.success}/{stat.total}
                  </span>
                </div>
                <Progress
                  value={stat.rate}
                  className="h-2 bg-secondary [&>div]:bg-destructive"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Severity Distribution */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              By Severity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {severityStats.map((stat) => (
              <div
                key={stat.severity}
                className="flex items-center justify-between"
              >
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase ${severityBadgeClass(stat.severity)}`}
                >
                  {stat.severity}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {stat.success} breached / {stat.total} total
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Search & Filters */}
      <Card className="border-border bg-card">
        <CardContent className="space-y-3 p-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search payloads, prompts, responses…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 bg-background pl-9 pr-9 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-[160px] bg-background text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {ALL_SEVERITIES.map((sev) => (
                  <SelectItem key={sev} value={sev}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterClassification} onValueChange={setFilterClassification}>
              <SelectTrigger className="h-8 w-[180px] bg-background text-xs">
                <SelectValue placeholder="Classification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classifications</SelectItem>
                {ALL_CLASSIFICATIONS.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {classificationLabel(cls)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Breached</SelectItem>
                <SelectItem value="fail">Blocked</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={clearAllFilters}
              >
                <X className="h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>

          {/* Sort & Actions Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sort:
            </span>
            {(
              [
                ["name", "Name"],
                ["severity", "Severity"],
                ["classification", "Classification"],
                ["score", "Score"],
                ["duration", "Duration"],
              ] as [SortField, string][]
            ).map(([field, label]) => (
              <Button
                key={field}
                size="sm"
                variant={sortField === field ? "secondary" : "ghost"}
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => toggleSort(field)}
              >
                {sortIcon(field)}
                {label}
              </Button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={expandAll}
              >
                <ChevronsUpDown className="h-3 w-3" />
                Expand all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={collapseAll}
              >
                <ChevronsDownUp className="h-3 w-3" />
                Collapse
              </Button>
              <span className="text-xs text-muted-foreground">
                {filteredResults.length} / {results.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results List */}
      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {filteredResults.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {results.length === 0
                ? "Waiting for results..."
                : "No results match the current filters."}
            </p>
          )}

          {filteredResults.map((result) => {
            const isExpanded = expandedResults.has(result.id);

            return (
              <div
                key={result.id}
                className={`rounded-lg border bg-card transition-colors ${
                  result.success
                    ? "border-l-2 border-l-destructive border-t-border border-r-border border-b-border"
                    : "border-l-2 border-l-success border-t-border border-r-border border-b-border"
                }`}
              >
                <button
                  onClick={() => toggleExpand(result.id)}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  {statusIcon(result)}

                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {result.payloadName}
                    </span>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[10px] ${categoryBadgeClass(result.category)}`}
                  >
                    {CATEGORY_LABELS[result.category]}
                  </Badge>

                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${severityBadgeClass(result.severity)}`}
                  >
                    {result.severity}
                  </Badge>

                  <span
                    className={`text-xs font-medium ${
                      result.success ? "text-destructive" : "text-success"
                    }`}
                  >
                    {result.success ? "BREACHED" : "BLOCKED"}
                  </span>

                  <span className="font-mono text-xs text-muted-foreground">
                    {result.durationMs}ms
                  </span>

                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Prompt Sent
                      </p>
                      <pre className="rounded border border-border bg-sidebar p-2.5 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words break-all max-h-60 overflow-y-auto overflow-x-hidden min-w-0 max-w-full">
                        {result.prompt}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Response
                      </p>
                      <pre className="rounded border border-border bg-sidebar p-2.5 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words break-all max-h-60 overflow-y-auto overflow-x-hidden min-w-0 max-w-full">
                        {result.response}
                      </pre>
                    </div>
                    {result.analysis && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Analysis
                        </p>

                        {/* Classification + Confidence */}
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${classificationBadgeClass(result.analysis.classification)}`}
                          >
                            {classificationLabel(result.analysis.classification)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Confidence: {Math.round(result.analysis.confidence * 100)}%
                          </span>
                        </div>

                        {/* Severity Score Bar */}
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Severity Score</span>
                            <span className="font-mono font-medium text-foreground">
                              {result.analysis.severityScore}/10
                            </span>
                          </div>
                          <Progress
                            value={result.analysis.severityScore * 10}
                            className={`h-2 bg-secondary ${severityScoreColor(result.analysis.severityScore)}`}
                          />
                        </div>

                        {/* Reasoning */}
                        <p className="text-sm text-foreground">
                          {result.analysis.reasoning}
                        </p>

                        {/* Indicators */}
                        {result.analysis.indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {result.analysis.indicators.map((indicator) => (
                              <Badge
                                key={indicator}
                                variant="outline"
                                className="border-border text-[10px] text-muted-foreground"
                              >
                                {indicator}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Leaked Data */}
                        {result.analysis.leakedData.length > 0 && (
                          <div className="rounded border border-destructive/40 bg-destructive/5 p-2">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-destructive">
                              Leaked Data ({result.analysis.leakedData.length})
                            </p>
                            <div className="space-y-1">
                              {result.analysis.leakedData.map((data, i) => (
                                <pre
                                  key={i}
                                  className="rounded bg-background/50 px-2 py-1 font-mono text-xs text-destructive/80 whitespace-pre-wrap break-all"
                                >
                                  {data}
                                </pre>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Breach Explanation */}
                    {result.success && activeTarget && (
                      <div className="pt-1">
                        {!explanations[result.id] ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-7"
                            disabled={explaining[result.id] || !redTeamConfig}
                            title={!redTeamConfig ? "Configure a Red Team LLM to use AI features" : undefined}
                            onClick={() => explainBreach(result)}
                          >
                            {explaining[result.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            {explaining[result.id] ? "Analyzing…" : "Explain This Breach"}
                          </Button>
                        ) : (
                          <div className="rounded border border-destructive/20 bg-destructive/5 p-3">
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-destructive">
                              <Sparkles className="h-3 w-3" />
                              AI Security Analysis
                            </p>
                            <p className="text-sm text-foreground leading-relaxed">
                              {explanations[result.id]}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Per-result retry for errors */}
                    {result.status === "error" && activeTarget && (
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-warning/30 text-warning hover:bg-warning/10 text-xs h-7"
                          disabled={retryingSingle[result.id] || isRunning}
                          onClick={() => retrySinglePayload(result)}
                        >
                          {retryingSingle[result.id] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          {retryingSingle[result.id] ? "Retrying…" : "Retry This Payload"}
                        </Button>
                      </div>
                    )}

                    {/* AI Payload Mutation */}
                    {!result.success && result.status !== "error" && activeTarget && (
                      <div className="pt-1">
                        {!mutations[result.id] ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-warning/30 text-warning hover:bg-warning/10 text-xs h-7"
                            disabled={mutating[result.id] || !redTeamConfig}
                            title={!redTeamConfig ? "Configure a Red Team LLM to use AI features" : undefined}
                            onClick={() => mutatePayload(result)}
                          >
                            {mutating[result.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                            {mutating[result.id] ? "Mutating…" : "Mutate with AI"}
                          </Button>
                        ) : (
                          <div className="rounded border border-warning/20 bg-warning/5 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-warning">
                                <Wand2 className="h-3 w-3" />
                                Mutated Payload — {mutations[result.id].technique}
                              </p>
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      mutations[result.id].mutatedPrompt
                                    )
                                  }
                                >
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    saveMutationToEditor(result, mutations[result.id].mutatedPrompt)
                                  }
                                >
                                  <BookmarkPlus className="h-3 w-3" />
                                  Save
                                </Button>
                              </div>
                            </div>
                            <pre className="rounded bg-background/50 px-2.5 py-2 font-mono text-xs text-foreground whitespace-pre-wrap break-words break-all max-h-60 overflow-y-auto overflow-x-hidden min-w-0 max-w-full">
                              {mutations[result.id].mutatedPrompt}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
