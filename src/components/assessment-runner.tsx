"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { Assessment, AttackRun, AttackResult } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { getTargetKeyFields } from "@/lib/target-utils";
import { generateId } from "@/lib/uuid";
import { generateFindingsFromResults } from "@/lib/findings";
import { resolvePayloads } from "@/lib/evolve/runner";
import { SHORTCUT_EVENTS } from "@/lib/use-keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Play,
  Square,
  AlertTriangle,
  Clock,
  Activity,
  FileText,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface AssessmentRunnerProps {
  assessment: Assessment;
  onBack: () => void;
  autoStart?: boolean;
}

export function AssessmentRunner({
  assessment,
  onBack,
  autoStart = false,
}: AssessmentRunnerProps) {
  const {
    targets,
    runs,
    addRun,
    addResult,
    completeRun,
    cancelRun,
    updateAssessment,
    generateFindingsForAssessment,
    isRunning,
    setIsRunning,
    isStopping,
    setIsStopping,
    cancelActiveExecution,
    setCancelActiveExecution,
    setView,
    runProgress,
    setRunProgress,
    incrementRunProgress,
  } = useStore();

  const target = targets.find((t) => t.id === assessment.targetId);

  // Associated runs for this assessment
  const assessmentRuns = runs.filter(
    (r) => assessment.runIds.includes(r.id) || r.assessmentId === assessment.id
  );
  const runningRun = assessmentRuns.find((r) => r.status === "running");
  const latestRun = runningRun || assessmentRuns[0] || null;

  // Local execution state
  const [activeRunId, setActiveRunId] = useState<string | null>(latestRun?.id || null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentProbeName, setCurrentProbeName] = useState<string>("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const completedProbeIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Results for the currently active run
  const activeRun = runs.find((r) => r.id === activeRunId) || latestRun;
  const results = activeRun?.results || [];

  // Denominator: Total scheduled payloads
  const scheduledPayloads = resolvePayloads({
    categories: assessment.configuration.categories,
    payloadIds: assessment.configuration.customPayloadIds,
  });
  const totalExpected =
    runProgress?.total ||
    activeRun?.totalPayloads ||
    scheduledPayloads.length ||
    results.length ||
    0;

  // Numerator: Authoritative completed count from activeRun results
  const completedCount = results.length;
  const progressPercent =
    totalExpected > 0 ? Math.min(100, Math.round((completedCount / totalExpected) * 100)) : 0;

  // Derived breaches
  const breaches = results.filter((r) => r.success);

  // Live findings derived from current results
  const liveFindings = generateFindingsFromResults(
    assessment.id,
    assessment.targetId,
    results
  );

  const stopExecution = useCallback(() => {
    if (isStopping || !isRunning) return;
    setIsStopping(true);
    if (readerRef.current) {
      try {
        readerRef.current.cancel();
      } catch {
        // Stream cancel ignored
      }
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (cancelActiveExecution) {
      try {
        cancelActiveExecution();
      } catch {
        // Ignored
      }
    }
  }, [isStopping, isRunning, setIsStopping, cancelActiveExecution]);

  const stopExecutionRef = useRef<() => void>(stopExecution);
  stopExecutionRef.current = stopExecution;

  // Keep elapsed seconds up to date
  useEffect(() => {
    if (activeRun && activeRun.status === "running") {
      setElapsedSeconds(Math.floor((Date.now() - activeRun.startTime) / 1000));
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - activeRun.startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else if (activeRun && activeRun.endTime) {
      setElapsedSeconds(Math.floor((activeRun.endTime - activeRun.startTime) / 1000));
    }
  }, [activeRun?.status, activeRun?.startTime, activeRun?.endTime]);

  // Synchronize cancellation with keyboard shortcut event
  useEffect(() => {
    const handleStopShortcut = () => {
      if (isRunning) {
        stopExecutionRef.current();
      }
    };
    window.addEventListener(SHORTCUT_EVENTS.STOP_ATTACKS, handleStopShortcut);
    return () => {
      window.removeEventListener(SHORTCUT_EVENTS.STOP_ATTACKS, handleStopShortcut);
    };
  }, [isRunning]);

  const startExecution = async () => {
    if (!target) {
      toast.error("Target configuration not found");
      return;
    }

    if (isRunning) return;

    const scheduledPayloads = resolvePayloads({
      categories: assessment.configuration.categories,
      payloadIds: assessment.configuration.customPayloadIds,
    });
    const totalPayloads = scheduledPayloads.length;

    const runId = generateId();
    setActiveRunId(runId);

    const newRun: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: assessment.configuration.categories,
      results: [],
      startTime: Date.now(),
      status: "running",
      assessmentId: assessment.id,
      totalPayloads,
    };

    addRun(newRun);

    // Link run to assessment
    updateAssessment(assessment.id, {
      status: "running",
      startedAt: Date.now(),
      runIds: [runId, ...assessment.runIds],
    });

    setIsRunning(true);
    setIsStopping(false);
    setRunProgress({ total: totalPayloads, completed: 0, startTime: Date.now() });
    completedProbeIdsRef.current.clear();
    setElapsedSeconds(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setCancelActiveExecution(() => {
      if (readerRef.current) {
        try {
          readerRef.current.cancel();
        } catch {
          // ignore
        }
      }
      controller.abort();
    });

    // Timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    let wasCancelled = false;
    let executionFailed = false;
    let failureReason = "";

    try {
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: target.endpoint,
          ...getTargetKeyFields(target),
          model: target.model,
          provider: target.provider,
          categories: assessment.configuration.categories,
          payloadIds: assessment.configuration.customPayloadIds,
          concurrency: assessment.configuration.concurrency || 1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        executionFailed = true;
        let sanitizedError = "";
        try {
          const errData = await res.json();
          if (errData && typeof errData.error === "string") {
            sanitizedError = errData.error.trim().slice(0, 300);
          }
        } catch {
          // Non-JSON response
        }

        switch (res.status) {
          case 400:
            failureReason = sanitizedError || "Invalid assessment request (HTTP 400)";
            break;
          case 401:
            failureReason = sanitizedError || "Authentication required (HTTP 401)";
            break;
          case 403:
            failureReason = sanitizedError || "Access forbidden (HTTP 403)";
            break;
          case 404:
            failureReason = "Assessment endpoint not found (HTTP 404)";
            break;
          case 408:
            failureReason = "Assessment request timed out (HTTP 408)";
            break;
          case 429:
            failureReason = sanitizedError || "Rate limit exceeded (HTTP 429). Please wait before retrying.";
            break;
          case 500:
            failureReason = "Internal server error occurred during assessment (HTTP 500)";
            break;
          case 502:
            failureReason = sanitizedError || "Target model connection failed (HTTP 502)";
            break;
          case 503:
            failureReason = "Target service unavailable (HTTP 503)";
            break;
          default:
            failureReason = sanitizedError || `Assessment request failed with HTTP ${res.status}`;
            break;
        }

        toast.error(failureReason);
        return;
      }

      const reader = res.body?.getReader();
      readerRef.current = reader || null;
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
                const total = Math.max(0, parsed.totalPayloads);
                setRunProgress({ total, completed: results.length, startTime });
              } else if (parsed.id || parsed.payloadId) {
                const probeId = (parsed.id || parsed.payloadId) as string;
                if (!completedProbeIdsRef.current.has(probeId)) {
                  completedProbeIdsRef.current.add(probeId);
                  const resultWithContext: AttackResult = {
                    ...parsed,
                    assessmentId: assessment.id,
                    targetId: target.id,
                  };
                  addResult(runId, resultWithContext);
                  incrementRunProgress();
                  if (resultWithContext.payloadName) {
                    setCurrentProbeName(resultWithContext.payloadName);
                  }
                }
              }
            } catch {
              // skip unparseable lines
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
        executionFailed = true;
        failureReason = err instanceof Error ? err.message.slice(0, 300) : "Execution encountered an error";
        console.error("Assessment execution error:", err);
        toast.error(failureReason);
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      abortControllerRef.current = null;
      readerRef.current = null;
      setIsRunning(false);
      setIsStopping(false);
      setRunProgress(null);
      setCancelActiveExecution(null);

      if (wasCancelled || controller.signal.aborted) {
        cancelRun(runId);
        updateAssessment(assessment.id, {
          status: "stopped",
          updatedAt: Date.now(),
        });
        toast.info("Assessment execution stopped");
      } else if (executionFailed) {
        cancelRun(runId);
        updateAssessment(assessment.id, {
          status: "failed",
          updatedAt: Date.now(),
        });
      } else {
        completeRun(runId);
        updateAssessment(assessment.id, {
          status: "completed",
          completedAt: Date.now(),
          updatedAt: Date.now(),
        });
        // Derive findings and calculate quantitative summary
        generateFindingsForAssessment(assessment.id);
        toast.success("Assessment execution completed");
      }
    }
  };

  useEffect(() => {
    if (autoStart && !isRunning && assessment.status !== "completed") {
      startExecution();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-mono tracking-tight text-foreground">
                {assessment.name}
              </h1>
              <Badge
                variant="outline"
                className={`font-mono text-[10px] uppercase rounded-[2px] ${
                  isRunning
                    ? "border-warning/40 bg-warning/10 text-warning animate-pulse"
                    : assessment.status === "completed"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {isRunning ? "RUNNING" : assessment.status}
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Target: <span className="text-foreground">{target?.name}</span> ({target?.model} via {target?.provider})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              size="sm"
              onClick={stopExecution}
              disabled={isStopping}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium text-xs rounded-[3px] h-8 shadow-none"
            >
              {isStopping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5 fill-current" />
              )}
              {isStopping ? "Stopping..." : "Stop Run"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={startExecution}
              className="gap-1.5 bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground font-medium text-xs rounded-[3px] h-8 shadow-none"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {assessment.status === "completed" ? "Rerun Assessment" : "Execute Assessment"}
            </Button>
          )}

          {assessment.status === "completed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("findings")}
                className="gap-1.5 border-border bg-card hover:bg-muted text-foreground text-xs rounded-[3px] h-8"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                View Findings ({liveFindings.length})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("reports")}
                className="gap-1.5 border-border bg-card hover:bg-muted text-foreground text-xs rounded-[3px] h-8"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Report
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Real Execution Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Probes Completed</span>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {totalExpected > 0 ? Math.min(completedCount, totalExpected) : completedCount}
            {totalExpected > 0 && (
              <span className="text-xs font-mono text-muted-foreground font-normal"> / {totalExpected}</span>
            )}
          </div>
          <div className="pt-2">
            <Progress value={progressPercent} className="h-1.5 [&>[data-slot=progress-indicator]]:bg-primary bg-muted rounded-[2px]" />
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Breaches Detected</span>
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          </div>
          <div className="text-xl font-bold font-mono text-destructive">
            {breaches.length}
          </div>
          <p className="text-xs font-mono text-muted-foreground pt-1">
            {completedCount > 0
              ? `${((breaches.length / completedCount) * 100).toFixed(1)}% breach rate`
              : "No probes completed"}
          </p>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Execution Time</span>
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
          </div>
          <p className="text-xs font-mono text-muted-foreground pt-1">
            {isRunning ? "Stream active" : "Execution halted"}
          </p>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Derived Findings</span>
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {liveFindings.length}
          </div>
          <p className="text-xs font-mono text-muted-foreground pt-1">
            Vulnerability patterns
          </p>
        </div>
      </div>

      {/* Active Probe Banner (when running) */}
      {isRunning && (
        <div className="flex items-center gap-3 rounded-[3px] border border-border bg-muted px-3.5 py-2.5 text-xs text-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <div className="flex-1 truncate font-mono text-xs">
            <span className="text-muted-foreground">Current Test Probe: </span>
            <span className="text-foreground font-medium">{currentProbeName || "Initializing..."}</span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {progressPercent}% Complete
          </span>
        </div>
      )}

      {/* Split Console: Live Results Feed & Live Findings */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Streamed Results Feed */}
        <div className="rounded-[4px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="border-b border-border p-3 flex items-center justify-between">
            <div className="text-xs font-medium font-mono uppercase tracking-wider text-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              Execution Stream ({results.length})
            </div>
            <span className="font-mono text-[10px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
              REAL-TIME
            </span>
          </div>
          <div className="p-0">
            <ScrollArea className="h-96">
              {results.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-mono italic">
                  No execution probes recorded yet. Click Execute Assessment to begin.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {results.slice().reverse().map((r) => (
                    <div key={r.id} className="p-2.5 text-xs flex items-start justify-between gap-3 hover:bg-muted/50 transition-colors">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-foreground truncate">
                            {r.payloadName}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono border-border bg-muted text-muted-foreground rounded-[2px]">
                            {CATEGORY_LABELS[r.category]}
                          </Badge>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground line-clamp-1">
                          {r.response || "(No response)"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {r.durationMs}ms
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 font-mono rounded-[2px] ${
                            r.success
                              ? "border-destructive/40 bg-destructive/15 text-destructive"
                              : "border-success/30 bg-success/10 text-success"
                          }`}
                        >
                          {r.success ? "BREACH" : "BLOCKED"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Live Derived Findings */}
        <div className="rounded-[4px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="border-b border-border p-3 flex items-center justify-between">
            <div className="text-xs font-medium font-mono uppercase tracking-wider text-foreground flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Vulnerability Findings ({liveFindings.length})
            </div>
            <span className="font-mono text-[10px] text-warning border border-warning/40 bg-warning/10 px-1.5 py-0.5 rounded-[2px]">
              SYNTHESIZED
            </span>
          </div>
          <div className="p-0">
            <ScrollArea className="h-96">
              {liveFindings.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground font-mono italic">
                  {completedCount === 0
                    ? "Findings will appear here automatically when vulnerabilities are detected."
                    : "Zero breaches detected so far. Target is defending successfully."}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {liveFindings.map((f) => (
                    <div key={f.id} className="p-3 text-xs space-y-1.5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-foreground">
                          {f.title}
                        </span>
                        <Badge
                          className={`text-[10px] py-0 px-1.5 uppercase font-mono rounded-[2px] ${
                            f.severity === "critical"
                              ? "bg-destructive/15 text-destructive border border-destructive/40"
                              : f.severity === "high"
                                ? "bg-warning/15 text-warning border border-warning/40"
                                : "bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/40"
                          }`}
                        >
                          {f.severity}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                        {f.description}
                      </p>

                      {f.evidence.length > 0 && (
                        <div className="rounded-[2px] bg-muted p-2 font-mono text-[11px] text-foreground border border-border break-words break-all whitespace-pre-wrap max-h-36 overflow-y-auto min-w-0 max-w-full">
                          <span className="text-muted-foreground">Evidence: </span>
                          &ldquo;{f.evidence[0]}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
