"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { generateId } from "@/lib/uuid";

import { useStore } from "@/lib/store";
import { SHORTCUT_EVENTS } from "@/lib/use-keyboard-shortcuts";
import type { AttackCategory, AttackRun } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { getTargetKeyFields } from "@/lib/target-utils";
import { resolvePayloads } from "@/lib/evolve/runner";
import {
  Shield,
  Target,
  Play,
  Square,
  FileText,
  Plus,
  Wifi,
  WifiOff,
  BarChart3,
  Link2,
  Database,
  Edit3,
  GitCompareArrows,
  Brain,
  Grid3X3,
  GitBranch,
  Calculator,
  Sparkles,
  LogOut,
  Zap,
  Minus,
  LayoutDashboard,
  Settings,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { CentauriAegisLogo } from "@/components/ui/logo";

const ATTACK_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
  "tool_abuse",
  "multi_turn",
  "encoding",
];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function RunProgressDisplay({
  progress,
  isStopping,
}: {
  progress: { total: number; completed: number; startTime: number };
  isStopping: boolean;
}) {
  const [now, setNow] = useState(progress.startTime);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const { total, completed, startTime } = progress;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const elapsed = Math.max(0, now - startTime);
  const avgPerPayload = completed > 0 ? elapsed / completed : 0;
  const remaining = completed > 0 && total > completed ? Math.round(avgPerPayload * (total - completed)) : 0;

  return (
    <div className="space-y-1.5 rounded-[3px] border border-sidebar-border bg-sidebar-accent/50 p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-medium text-sidebar-foreground text-xs">
          {completed}/{total}
        </span>
        <span className="font-mono text-muted-foreground text-xs">{percent}%</span>
      </div>
      <Progress
        value={percent}
        className="h-1.5 [&>[data-slot=progress-indicator]]:bg-primary bg-muted rounded-[2px]"
      />
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>{formatDuration(elapsed)} elapsed</span>
        {completed > 0 && completed < total && !isStopping && (
          <span>~{formatDuration(remaining)} left</span>
        )}
        {isStopping && <span className="text-warning">Stopping...</span>}
        {completed === total && total > 0 && <span>Done!</span>}
      </div>
    </div>
  );
}

export function Sidebar() {
  const {
    targets,
    activeTargetId,
    setActiveTarget,
    assessments,
    activeAssessmentId,
    findings,
    selectedCategories,
    toggleCategory,
    isRunning,
    setIsRunning,
    isStopping,
    setIsStopping,
    view,
    setView,
    addRun,
    addResult,
    completeRun,
    cancelRun,
    setActiveRun,
    concurrency,
    setConcurrency,
    runProgress,
    setRunProgress,
    incrementRunProgress,
    redTeamConfig,
    cancelActiveExecution,
    setCancelActiveExecution,
  } = useStore();

  const { authEnabled, username, logout } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const canRun =
    activeTargetId !== null && selectedCategories.length > 0 && !isRunning && !isStopping;

  // Refs for keyboard shortcut event handlers (avoid stale closures)
  const runAttacksRef = useRef<(() => void) | null>(null);
  const stopAttacksRef = useRef<(() => void) | null>(null);

  const stopAttacks = useCallback(() => {
    if (isStopping || !isRunning) return;
    setIsStopping(true);
    if (cancelActiveExecution) {
      try {
        cancelActiveExecution();
      } catch (err) {
        console.error("Error cancelling execution:", err);
      }
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [isStopping, isRunning, setIsStopping, cancelActiveExecution]);

  const runAttacks = useCallback(async () => {
    const target = targets.find((t) => t.id === activeTargetId);
    if (!target) return;
    if (isRunning) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setCancelActiveExecution(() => {
      controller.abort();
    });

    const scheduledPayloads = resolvePayloads({ categories: selectedCategories });
    const totalPayloads = scheduledPayloads.length;

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: selectedCategories,
      results: [],
      startTime: Date.now(),
      status: "running",
      totalPayloads,
      assessmentId: activeAssessmentId || undefined,
    };

    addRun(run);
    setActiveRun(runId);
    setIsRunning(true);
    setIsStopping(false);
    setRunProgress({ total: totalPayloads, completed: 0, startTime: Date.now() });
    setView("results");

    let wasCancelled = false;

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
          concurrency,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        if (controller.signal.aborted) {
          wasCancelled = true;
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          break;
        }

        let chunk;
        try {
          chunk = await reader.read();
        } catch (e) {
          if (controller.signal.aborted) {
            wasCancelled = true;
            break;
          }
          throw e;
        }

        const { done, value } = chunk;
        if (done) {
          if (controller.signal.aborted) {
            wasCancelled = true;
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "meta" && typeof parsed.totalPayloads === "number") {
                setRunProgress({ total: parsed.totalPayloads, completed: 0, startTime: Date.now() });
              } else if (parsed.id || parsed.payloadId) {
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
        wasCancelled = true;
      } else if (controller.signal.aborted) {
        wasCancelled = true;
      } else {
        console.error("Attack run failed:", err);
      }
    } finally {
      abortRef.current = null;
      setCancelActiveExecution(null);
      setIsRunning(false);
      setIsStopping(false);
      setRunProgress(null);

      if (wasCancelled || controller.signal.aborted) {
        cancelRun(runId);
      } else {
        completeRun(runId);
      }
    }
  }, [targets, activeTargetId, isRunning, selectedCategories, activeAssessmentId, addRun, setActiveRun, setIsRunning, setIsStopping, setRunProgress, setView, concurrency, setCancelActiveExecution, addResult, incrementRunProgress, cancelRun, completeRun]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleRun = () => runAttacksRef.current?.();
    const handleStop = () => stopAttacksRef.current?.();
    window.addEventListener(SHORTCUT_EVENTS.RUN_ATTACKS, handleRun);
    window.addEventListener(SHORTCUT_EVENTS.STOP_ATTACKS, handleStop);
    return () => {
      window.removeEventListener(SHORTCUT_EVENTS.RUN_ATTACKS, handleRun);
      window.removeEventListener(SHORTCUT_EVENTS.STOP_ATTACKS, handleStop);
    };
  }, []);

  runAttacksRef.current = canRun ? runAttacks : null;
  stopAttacksRef.current = isRunning ? stopAttacks : null;

  const getNavClass = (isActive: boolean) =>
    `flex items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
      isActive
        ? "bg-sidebar-accent text-sidebar-foreground border-l-2 border-primary"
        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    }`;

  const getNavIconClass = (isActive: boolean) =>
    `h-3.5 w-3.5 shrink-0 ${isActive ? "text-sidebar-foreground" : "text-muted-foreground"}`;

  return (
    <aside className="flex h-screen w-[270px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-sidebar-border">
        <CentauriAegisLogo size={26} className="shrink-0" />
        <div className="flex flex-col">
          <span className="font-sans text-xs font-semibold tracking-wider text-sidebar-foreground uppercase">
            Centauri Aegis
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
            Security Testing Console
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-2.5">
          {/* WORKSPACE Section */}
          <div className="mb-2.5">
            <h2 className="mb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Workspace
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("dashboard")}
                className={getNavClass(view === "dashboard")}
              >
                <LayoutDashboard className={getNavIconClass(view === "dashboard")} />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setView("config")}
                className={getNavClass(view === "config")}
              >
                <Target className={getNavIconClass(view === "config")} />
                <span>Target Workspace</span>
              </button>

              <button
                onClick={() => setView("assessments")}
                className={`flex items-center justify-between rounded-[3px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === "assessments"
                    ? "bg-sidebar-accent text-sidebar-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className={getNavIconClass(view === "assessments")} />
                  <span>Assessments</span>
                </div>
                {assessments.length > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground bg-sidebar-accent border border-sidebar-border px-1.5 py-0.2 rounded-[2px]">
                    {assessments.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setView("findings")}
                className={`flex items-center justify-between rounded-[3px] px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === "findings"
                    ? "bg-sidebar-accent text-sidebar-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className={getNavIconClass(view === "findings")} />
                  <span>Findings</span>
                </div>
                {findings.length > 0 && (
                  <span className="font-mono text-[10px] text-warning bg-sidebar-accent border border-sidebar-border px-1.5 py-0.2 rounded-[2px]">
                    {findings.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setView("session")}
                className={getNavClass(view === "session")}
              >
                <Database className={getNavIconClass(view === "session")} />
                <span>Session Manager</span>
              </button>
            </div>

            {/* Active Target Drawer */}
            <div className="mt-2 rounded-[3px] border border-sidebar-border bg-card p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
                <span>Active Target</span>
                <button
                  onClick={() => setView("config")}
                  className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>

              {targets.length === 0 ? (
                <p className="px-1 py-1 text-[11px] text-muted-foreground italic font-sans">
                  No targets configured
                </p>
              ) : (
                targets.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => setActiveTarget(target.id)}
                    className={`flex w-full items-center gap-2 rounded-[2px] px-1.5 py-1 text-xs transition-colors hover:bg-sidebar-accent/60 ${
                      activeTargetId === target.id
                        ? "bg-sidebar-accent text-sidebar-foreground border border-sidebar-border font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        target.connected ? "bg-success" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="truncate flex-1 text-left">{target.name}</span>
                    {target.connected ? (
                      <Wifi className="h-3 w-3 text-success shrink-0" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))
              )}

              {/* Red Team LLM */}
              <div className="mt-1 border-t border-sidebar-border pt-1">
                <button
                  onClick={() => setView("config")}
                  className="flex w-full items-center gap-1.5 rounded-[2px] px-1.5 py-1 text-[11px] transition-colors hover:bg-sidebar-accent/60 text-muted-foreground"
                >
                  <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
                  {redTeamConfig ? (
                    <>
                      <span className="truncate text-sidebar-foreground font-medium">{redTeamConfig.model}</span>
                      <span className={`ml-auto inline-block h-1.5 w-1.5 rounded-full ${redTeamConfig.connected ? "bg-success" : "bg-muted-foreground/40"}`} />
                    </>
                  ) : (
                    <span className="italic font-sans">No Red Team LLM</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <Separator className="my-1.5 bg-sidebar-border" />

          {/* TESTING Section */}
          <div className="mb-2.5">
            <h2 className="mb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Testing Workflows
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("attacks")}
                className={getNavClass(view === "attacks")}
              >
                <Shield className={getNavIconClass(view === "attacks")} />
                <span>Attack Modules</span>
              </button>

              <button
                onClick={() => setView("chains")}
                className={getNavClass(view === "chains")}
              >
                <Link2 className={getNavIconClass(view === "chains")} />
                <span>Attack Chains</span>
              </button>

              <button
                onClick={() => setView("adaptive")}
                className={getNavClass(view === "adaptive")}
              >
                <Brain className={getNavIconClass(view === "adaptive")} />
                <span>Adaptive Runner</span>
              </button>

              <button
                onClick={() => setView("evolve")}
                className={getNavClass(view === "evolve")}
              >
                <Sparkles className={getNavIconClass(view === "evolve")} />
                <span>Evolve Engine</span>
              </button>

              <button
                onClick={() => setView("editor")}
                className={getNavClass(view === "editor")}
              >
                <Edit3 className={getNavIconClass(view === "editor")} />
                <span>Payload Editor</span>
              </button>
            </div>

            {/* Attack Categories Checklist Drawer */}
            <div className="mt-2 rounded-[3px] border border-sidebar-border bg-card p-2 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1 block mb-1">
                Active Categories ({selectedCategories.length}/7)
              </span>
              <div className="space-y-0.5">
                {ATTACK_CATEGORIES.map((cat) => (
                  <label
                    key={cat}
                    className="flex cursor-pointer items-center gap-2 rounded-[2px] px-1.5 py-1 text-[11px] transition-colors hover:bg-sidebar-accent/60 text-muted-foreground hover:text-sidebar-foreground"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={() => toggleCategory(cat)}
                      className="border-sidebar-border data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground rounded-[2px] h-3.5 w-3.5"
                    />
                    <span className="truncate">{CATEGORY_LABELS[cat]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Separator className="my-1.5 bg-sidebar-border" />

          {/* ANALYSIS Section */}
          <div className="mb-2.5">
            <h2 className="mb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Analysis & Metrics
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("results")}
                className={getNavClass(view === "results")}
              >
                <BarChart3 className={getNavIconClass(view === "results")} />
                <span>Results Dashboard</span>
              </button>

              <button
                onClick={() => setView("scoring")}
                className={getNavClass(view === "scoring")}
              >
                <Calculator className={getNavIconClass(view === "scoring")} />
                <span>Scoring & Rubrics</span>
              </button>

              <button
                onClick={() => setView("heatmap")}
                className={getNavClass(view === "heatmap")}
              >
                <Grid3X3 className={getNavIconClass(view === "heatmap")} />
                <span>Vulnerability Heatmap</span>
              </button>

              <button
                onClick={() => setView("regression")}
                className={getNavClass(view === "regression")}
              >
                <GitBranch className={getNavIconClass(view === "regression")} />
                <span>Regression Suite</span>
              </button>

              <button
                onClick={() => setView("comparison")}
                className={getNavClass(view === "comparison")}
              >
                <GitCompareArrows className={getNavIconClass(view === "comparison")} />
                <span>Run Comparison</span>
              </button>
            </div>
          </div>

          <Separator className="my-1.5 bg-sidebar-border" />

          {/* REPORTS Section */}
          <div className="mb-2.5">
            <h2 className="mb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Reports & Audit
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("reports")}
                className={getNavClass(view === "reports")}
              >
                <FileText className={getNavIconClass(view === "reports")} />
                <span>Executive Reports</span>
              </button>
            </div>
          </div>

          <Separator className="my-1.5 bg-sidebar-border" />

          {/* SYSTEM Section */}
          <div className="mb-2">
            <h2 className="mb-1 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              System
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("settings")}
                className={getNavClass(view === "settings")}
              >
                <Settings className={getNavIconClass(view === "settings")} />
                <span>Settings & Security</span>
              </button>

              <button
                onClick={() => setView("about")}
                className={getNavClass(view === "about")}
              >
                <Info className={getNavIconClass(view === "about")} />
                <span>About & Attribution</span>
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Theme Toggle */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-2 bg-sidebar">
        <ThemeToggle />
      </div>

      {/* RUN / STOP Buttons & Controls */}
      <div className="shrink-0 border-t border-sidebar-border p-3 space-y-2.5 bg-sidebar">
        {/* Concurrency selector */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Zap className="h-3 w-3" />
            Concurrency
          </label>
          <div className="flex items-center gap-1">
            <button
              className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-sidebar-border bg-card text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-30"
              onClick={() => setConcurrency(concurrency - 1)}
              disabled={concurrency <= 1 || isRunning}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-xs font-mono font-medium text-sidebar-foreground">
              {concurrency}
            </span>
            <button
              className="flex h-6 w-6 items-center justify-center rounded-[2px] border border-sidebar-border bg-card text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-30"
              onClick={() => setConcurrency(concurrency + 1)}
              disabled={concurrency >= 10 || isRunning}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isRunning && runProgress && runProgress.total > 0 && (
          <RunProgressDisplay progress={runProgress} isStopping={isStopping} />
        )}

        {isRunning ? (
          <Button
            className="w-full gap-2 bg-destructive font-sans font-medium text-xs text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 rounded-[3px] h-9 shadow-none tracking-wide"
            size="default"
            disabled={isStopping}
            onClick={stopAttacks}
          >
            {isStopping ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Square className="h-3.5 w-3.5 fill-current" />
            )}
            {isStopping ? "STOPPING..." : "STOP RUN"}
          </Button>
        ) : (
          <Button
            className="w-full gap-2 bg-primary font-sans font-medium text-xs text-primary-foreground hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] disabled:opacity-40 rounded-[3px] h-9 shadow-none tracking-wide"
            size="default"
            disabled={!canRun}
            onClick={runAttacks}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            RUN ATTACK
          </Button>
        )}

        {authEnabled && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {username || "authenticated"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-[2px] px-1.5"
              onClick={logout}
            >
              <LogOut className="h-3 w-3" />
              Logout
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
