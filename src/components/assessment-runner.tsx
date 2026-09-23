"use client";

import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import type { Assessment, AttackRun, AttackResult } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { getTargetKeyFields } from "@/lib/target-utils";
import { generateId } from "@/lib/uuid";
import { generateFindingsFromResults, calculateAssessmentSummary } from "@/lib/findings";
import { SHORTCUT_EVENTS } from "@/lib/use-keyboard-shortcuts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Target,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  FileText,
  Search,
  ArrowLeft,
  XCircle,
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
    setView,
    setCancelActiveExecution,
  } = useStore();

  const target = targets.find((t) => t.id === assessment.targetId);

  // Associated runs for this assessment
  const assessmentRuns = runs.filter((r) => assessment.runIds.includes(r.id));
  const latestRun = assessmentRuns[0] || null;

  // Local execution state
  const [activeRunId, setActiveRunId] = useState<string | null>(latestRun?.id || null);
  const [totalExpected, setTotalExpected] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [currentProbeName, setCurrentProbeName] = useState<string>("");
  const [isStopping, setIsStopping] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const completedProbeIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Results for the currently active run
  const activeRun = runs.find((r) => r.id === activeRunId);
  const results = activeRun?.results || [];

  // Derived breaches
  const breaches = results.filter((r) => r.success);

  // Live findings derived from current results
  const liveFindings = generateFindingsFromResults(
    assessment.id,
    assessment.targetId,
    results
  );

  const stopExecution = () => {
    if (isStopping) return;
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
  };

  const stopExecutionRef = useRef<() => void>(stopExecution);
  stopExecutionRef.current = stopExecution;

  // Synchronize cancellation with global store
  useEffect(() => {
    if (isRunning) {
      setCancelActiveExecution(() => stopExecutionRef.current());
    } else {
      setCancelActiveExecution(null);
    }
    return () => {
      setCancelActiveExecution(null);
    };
  }, [isRunning, setCancelActiveExecution]);

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
    setCompletedCount(0);
    completedProbeIdsRef.current.clear();
    setElapsedSeconds(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

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
          categories: assessment.configuration.categories,
          concurrency: assessment.configuration.concurrency || 1,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      readerRef.current = reader || null;
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        if (controller.signal.aborted) {
          wasCancelled = true;
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
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "meta" && typeof parsed.totalPayloads === "number") {
                const total = Math.max(0, parsed.totalPayloads);
                setTotalExpected(total);
                setCompletedCount((prev) => (total > 0 ? Math.min(total, prev) : prev));
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
                  setCompletedCount((c) => {
                    const next = c + 1;
                    return totalExpected > 0 ? Math.min(totalExpected, next) : next;
                  });
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
      } else {
        console.error("Assessment execution error:", err);
        toast.error("Execution encountered an error");
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      abortControllerRef.current = null;
      readerRef.current = null;
      setIsRunning(false);
      setIsStopping(false);
      setCancelActiveExecution(null);

      if (wasCancelled) {
        cancelRun(runId);
        updateAssessment(assessment.id, {
          status: "stopped",
          updatedAt: Date.now(),
        });
        toast.info("Assessment execution stopped");
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
      if (readerRef.current) {
        try {
          readerRef.current.cancel();
        } catch {
          // ignore
        }
      }
      setCancelActiveExecution(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressPercent =
    totalExpected > 0 ? Math.min(100, Math.round((completedCount / totalExpected) * 100)) : 0;

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-6">
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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold font-mono tracking-tight text-foreground">
                {assessment.name}
              </h1>
              <Badge
                variant="outline"
                className={`font-mono text-xs uppercase ${
                  isRunning
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : assessment.status === "completed"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-[#5B8DB8]/40 bg-[#5B8DB8]/10 text-[#5B8DB8]"
                }`}
              >
                {isRunning ? "RUNNING" : assessment.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Target: <span className="text-foreground font-medium">{target?.name}</span> ({target?.model} via {target?.provider})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              size="sm"
              variant="outline"
              onClick={stopExecution}
              disabled={isStopping}
              className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs"
            >
              {isStopping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {isStopping ? "Stopping..." : "Stop Run"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={startExecution}
              className="gap-1.5 bg-aegis hover:bg-aegis/90 text-white text-xs shadow-md shadow-black/40"
            >
              <Play className="h-3.5 w-3.5" />
              {assessment.status === "completed" ? "Rerun Assessment" : "Execute Assessment"}
            </Button>
          )}

          {assessment.status === "completed" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("findings")}
                className="gap-1.5 border-border hover:bg-card text-xs text-[#5B8DB8]"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                View Findings ({liveFindings.length})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("reports")}
                className="gap-1.5 border-border hover:bg-card text-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                Report
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Real Execution Telemetry Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Probes Completed</span>
              <Activity className="h-3.5 w-3.5 text-[#5B8DB8]" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono">
              {totalExpected > 0 ? Math.min(completedCount, totalExpected) : completedCount}
              {totalExpected > 0 && (
                <span className="text-xs text-muted-foreground font-normal"> / {totalExpected}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Progress value={progressPercent} className="h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Breaches Detected</span>
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-red-400">
              {breaches.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {completedCount > 0
                ? `${((breaches.length / completedCount) * 100).toFixed(1)}% breach rate`
                : "No probes completed"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Elapsed Execution Time</span>
              <Clock className="h-3.5 w-3.5 text-[#5B8DB8]" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono">
              {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              {isRunning ? "Stream actively receiving" : "Execution halted"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center justify-between">
              <span>Derived Findings</span>
              <Shield className="h-3.5 w-3.5 text-[#5B8DB8]" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-[#5B8DB8]">
              {liveFindings.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Grouped vulnerability patterns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Probe Banner (when running) */}
      {isRunning && (
        <div className="flex items-center gap-3 rounded-lg border border-[#5B8DB8]/30 bg-[#5B8DB8]/10 px-4 py-3 text-xs text-[#5B8DB8]">
          <Loader2 className="h-4 w-4 animate-spin text-aegis" />
          <div className="flex-1 truncate">
            Current Test Probe: <span className="font-mono text-foreground font-semibold">{currentProbeName || "Initializing..."}</span>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {progressPercent}% Complete
          </span>
        </div>
      )}

      {/* Split Console: Live Results Feed & Live Findings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Streamed Results Feed */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#5B8DB8]" />
                Live Execution Feed ({results.length})
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                Real-time
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {results.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  No execution probes recorded yet. Click Execute Assessment to begin.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {results.slice().reverse().map((r) => (
                    <div key={r.id} className="p-3 text-xs flex items-start justify-between gap-3 hover:bg-background/40">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">
                            {r.payloadName}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
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
                          variant={r.success ? "destructive" : "secondary"}
                          className={`text-[10px] py-0 px-1.5 ${
                            r.success
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
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
          </CardContent>
        </Card>

        {/* Live Derived Findings */}
        <Card className="border-border bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#5B8DB8]" />
                Vulnerability Findings ({liveFindings.length})
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-[#5B8DB8]/30 text-[#5B8DB8]">
                Derived
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {liveFindings.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">
                  {completedCount === 0
                    ? "Findings will appear here automatically when vulnerabilities are detected."
                    : "Zero breaches detected so far. Target is defending successfully."}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {liveFindings.map((f) => (
                    <div key={f.id} className="p-3.5 text-xs space-y-2 hover:bg-background/40">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">
                          {f.title}
                        </span>
                        <Badge
                          className={`text-[10px] py-0 px-1.5 uppercase font-mono ${
                            f.severity === "critical"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : f.severity === "high"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-[#5B8DB8]/20 text-[#5B8DB8] border border-[#5B8DB8]/30"
                          }`}
                        >
                          {f.severity}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {f.description}
                      </p>

                      {f.evidence.length > 0 && (
                        <div className="rounded bg-background/80 p-2.5 font-mono text-[11px] text-[#5B8DB8] border border-border/50 break-words break-all whitespace-pre-wrap max-h-36 overflow-y-auto min-w-0 max-w-full">
                          <span className="font-semibold text-muted-foreground">Evidence: </span>
                          &ldquo;{f.evidence[0]}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
