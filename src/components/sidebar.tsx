"use client";
import { useRef, useState, useEffect } from "react";
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
}: {
  progress: { total: number; completed: number; startTime: number };
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const { total, completed, startTime } = progress;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const elapsed = now - startTime;
  const avgPerPayload = completed > 0 ? elapsed / completed : 0;
  const remaining = completed > 0 ? Math.round(avgPerPayload * (total - completed)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono font-semibold text-foreground">
          {completed}/{total}
        </span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2 [&>[data-slot=progress-indicator]]:bg-redpincer" />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatDuration(elapsed)} elapsed</span>
        {completed > 0 && completed < total && (
          <span>~{formatDuration(remaining)} left</span>
        )}
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
    selectedCategories,
    toggleCategory,
    isRunning,
    setIsRunning,
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
  } = useStore();

  const { authEnabled, username, logout } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const canRun =
    activeTargetId !== null && selectedCategories.length > 0 && !isRunning;

  // Refs for keyboard shortcut event handlers (avoid stale closures)
  const runAttacksRef = useRef<(() => void) | null>(null);
  const stopAttacksRef = useRef<(() => void) | null>(null);

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

  const stopAttacks = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const runAttacks = async () => {
    const target = targets.find((t) => t.id === activeTargetId);
    if (!target) return;

    const controller = new AbortController();
    abortRef.current = controller;

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
    setActiveRun(runId);
    setIsRunning(true);
    setRunProgress({ total: 0, completed: 0, startTime: Date.now() });
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
              if (parsed.type === "meta" && typeof parsed.totalPayloads === "number") {
                setRunProgress({ total: parsed.totalPayloads, completed: 0, startTime: Date.now() });
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
        wasCancelled = true;
      } else {
        console.error("Attack run failed:", err);
      }
    } finally {
      if (wasCancelled) {
        cancelRun(runId);
      } else {
        completeRun(runId);
      }
      setIsRunning(false);
      setRunProgress(null);
      abortRef.current = null;
    }
  };

  // Keep refs in sync for keyboard shortcut events
  runAttacksRef.current = canRun ? runAttacks : null;
  stopAttacksRef.current = isRunning ? stopAttacks : null;

  return (
    <aside className="flex h-screen w-[280px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Centauri Aegis Brand Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/60">
        <CentauriAegisLogo size={32} className="drop-shadow-[0_0_12px_rgba(157,78,221,0.3)] shrink-0" />
        <div className="flex flex-col">
          <h1 className="text-sm font-bold tracking-tight text-foreground font-mono">
            CENTAURI <span className="text-aegis">AEGIS</span>
          </h1>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            AI Security Testing
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3">
          {/* WORKSPACE Section */}
          <div className="mb-3">
            <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("dashboard")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "dashboard"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-purple-400" />
                Dashboard
              </button>

              <button
                onClick={() => setView("config")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "config"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Target className="h-3.5 w-3.5 text-purple-400" />
                Target Config
              </button>

              <button
                onClick={() => setView("session")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "session"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Database className="h-3.5 w-3.5 text-purple-400" />
                Session Manager
              </button>
            </div>

            {/* Active Targets Drawer */}
            <div className="mt-2.5 rounded-md border border-border/50 bg-background/30 p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                <span>Active Target</span>
                <button
                  onClick={() => setView("config")}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>

              {targets.length === 0 ? (
                <p className="px-1 py-1 text-[11px] text-muted-foreground italic">
                  No targets configured
                </p>
              ) : (
                targets.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => setActiveTarget(target.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-sidebar-accent ${
                      activeTargetId === target.id
                        ? "bg-purple-500/15 text-purple-300 font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        target.connected ? "bg-emerald-400" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="truncate flex-1 text-left">{target.name}</span>
                    {target.connected ? (
                      <Wifi className="h-3 w-3 text-emerald-400 shrink-0" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))
              )}

              {/* Red Team LLM */}
              <div className="mt-1 border-t border-border/40 pt-1">
                <button
                  onClick={() => setView("config")}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-colors hover:bg-sidebar-accent text-muted-foreground"
                >
                  <Brain className="h-3 w-3 text-purple-400 shrink-0" />
                  {redTeamConfig ? (
                    <>
                      <span className="truncate text-purple-300">{redTeamConfig.model}</span>
                      <span className={`ml-auto inline-block h-1.5 w-1.5 rounded-full ${redTeamConfig.connected ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                    </>
                  ) : (
                    <span className="italic">No Red Team LLM</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <Separator className="my-1.5" />

          {/* TESTING Section */}
          <div className="mb-3">
            <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Testing Workflows
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("attacks")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "attacks"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Shield className="h-3.5 w-3.5 text-purple-400" />
                Attack Modules
              </button>

              <button
                onClick={() => setView("chains")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "chains"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Link2 className="h-3.5 w-3.5 text-purple-400" />
                Attack Chains
              </button>

              <button
                onClick={() => setView("adaptive")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "adaptive"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Brain className="h-3.5 w-3.5 text-purple-400" />
                Adaptive Runner
              </button>

              <button
                onClick={() => setView("evolve")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "evolve"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Evolve Engine
              </button>

              <button
                onClick={() => setView("editor")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "editor"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5 text-purple-400" />
                Payload Editor
              </button>
            </div>

            {/* Attack Categories Checklist Drawer */}
            <div className="mt-2.5 rounded-md border border-border/50 bg-background/30 p-2 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 block mb-1">
                Active Categories ({selectedCategories.length}/7)
              </span>
              <div className="space-y-1">
                {ATTACK_CATEGORIES.map((cat) => (
                  <label
                    key={cat}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-[11px] transition-colors hover:bg-sidebar-accent"
                  >
                    <Checkbox
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={() => toggleCategory(cat)}
                      className="border-muted-foreground data-[state=checked]:border-aegis data-[state=checked]:bg-aegis h-3.5 w-3.5"
                    />
                    <span className="truncate">{CATEGORY_LABELS[cat]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Separator className="my-1.5" />

          {/* ANALYSIS Section */}
          <div className="mb-3">
            <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Analysis & Metrics
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("results")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "results"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
                Results Dashboard
              </button>

              <button
                onClick={() => setView("scoring")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "scoring"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Calculator className="h-3.5 w-3.5 text-purple-400" />
                Scoring & Rubrics
              </button>

              <button
                onClick={() => setView("heatmap")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "heatmap"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Grid3X3 className="h-3.5 w-3.5 text-purple-400" />
                Vulnerability Heatmap
              </button>

              <button
                onClick={() => setView("regression")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "regression"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5 text-purple-400" />
                Regression Suite
              </button>

              <button
                onClick={() => setView("comparison")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "comparison"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <GitCompareArrows className="h-3.5 w-3.5 text-purple-400" />
                Run Comparison
              </button>
            </div>
          </div>

          <Separator className="my-1.5" />

          {/* REPORTS Section */}
          <div className="mb-3">
            <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reports & Audit
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("reports")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "reports"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-purple-400" />
                Executive Reports
              </button>
            </div>
          </div>

          <Separator className="my-1.5" />

          {/* SYSTEM Section */}
          <div className="mb-2">
            <h2 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              System
            </h2>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => setView("settings")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "settings"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Settings className="h-3.5 w-3.5 text-purple-400" />
                Settings & Security
              </button>

              <button
                onClick={() => setView("about")}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent ${
                  view === "about"
                    ? "bg-purple-500/15 text-purple-300 font-semibold border-l-2 border-aegis"
                    : "text-sidebar-foreground"
                }`}
              >
                <Info className="h-3.5 w-3.5 text-purple-400" />
                About & Attribution
              </button>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Theme Toggle */}
      <div className="shrink-0 border-t border-border px-4 py-2">
        <ThemeToggle />
      </div>

      {/* RUN / STOP Buttons */}
      <div className="shrink-0 border-t border-border p-4 space-y-2">
        {/* Concurrency selector */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3" />
            Concurrency
          </label>
          <div className="flex items-center gap-1">
            <button
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              onClick={() => setConcurrency(concurrency - 1)}
              disabled={concurrency <= 1 || isRunning}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-xs font-mono font-semibold text-foreground">
              {concurrency}
            </span>
            <button
              className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
              onClick={() => setConcurrency(concurrency + 1)}
              disabled={concurrency >= 10 || isRunning}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {isRunning && runProgress && runProgress.total > 0 && (
          <RunProgressDisplay progress={runProgress} />
        )}

        {isRunning ? (
          <Button
            className="w-full gap-2 bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90"
            size="lg"
            onClick={stopAttacks}
          >
            <Square className="h-4 w-4" />
            STOP
          </Button>
        ) : (
          <Button
            className="w-full gap-2 bg-aegis font-semibold text-white hover:bg-aegis/90 disabled:opacity-40 shadow-md shadow-purple-950/40"
            size="lg"
            disabled={!canRun}
            onClick={runAttacks}
          >
            <Play className="h-4 w-4" />
            RUN ATTACK
          </Button>
        )}

        {authEnabled && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground truncate">
              {username || "authenticated"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
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
