"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { getTargetKeyFields } from "@/lib/target-utils";
import type {
  EvolveGenerationProgressEvent,
  EvolveGenerationSummaryEvent,
  EvolveLineageExportEvent,
  EvolveMetaEvent,
  EvolveMutationMode,
  EvolveStreamEvent,
} from "@/lib/evolve/types";
import { CATEGORY_LABELS, type AttackPayload } from "@/lib/types";
import { downloadFile } from "@/lib/export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function upsertSummary(
  current: EvolveGenerationSummaryEvent[],
  incoming: EvolveGenerationSummaryEvent
): EvolveGenerationSummaryEvent[] {
  const next = current.filter((summary) => summary.generation !== incoming.generation);
  next.push(incoming);
  return next.sort((left, right) => left.generation - right.generation);
}

function formatGenerationLabel(generation: number, totalGenerations: number): string {
  return `G${generation} (${generation + 1}/${totalGenerations})`;
}

const CUSTOM_PAYLOADS_STORAGE_KEY = "centauri-aegis-custom-payloads";

function loadCustomPayloadsFromStorage(): AttackPayload[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(CUSTOM_PAYLOADS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttackPayload[]) : [];
  } catch {
    return [];
  }
}

export function EvolveRunner() {
  const { targets, activeTargetId, selectedCategories, concurrency, isRunning } = useStore();
  const [generations, setGenerations] = useState(3);
  const [topK, setTopK] = useState(3);
  const [mutationRate, setMutationRate] = useState(0.5);
  const [mutationMode, setMutationMode] = useState<EvolveMutationMode>("deterministic");
  const [running, setRunning] = useState(false);
  const [meta, setMeta] = useState<EvolveMetaEvent | null>(null);
  const [progress, setProgress] = useState<EvolveGenerationProgressEvent | null>(null);
  const [summaries, setSummaries] = useState<EvolveGenerationSummaryEvent[]>([]);
  const [lineageExport, setLineageExport] = useState<EvolveLineageExportEvent | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const activeTarget = useMemo(
    () => targets.find((target) => target.id === activeTargetId) ?? null,
    [activeTargetId, targets]
  );

  const canRun =
    !!activeTarget &&
    selectedCategories.length > 0 &&
    !running &&
    !isRunning;

  const stopEvolution = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleStreamLine = (line: string) => {
    const parsed = JSON.parse(line) as EvolveStreamEvent;
    if (parsed.type === "meta") {
      setMeta(parsed);
      return;
    }
    if (parsed.type === "generation_progress") {
      setProgress(parsed);
      return;
    }
    if (parsed.type === "generation_summary") {
      setSummaries((current) => upsertSummary(current, parsed));
      return;
    }
    if (parsed.type === "lineage_export") {
      setLineageExport(parsed);
    }
  };

  const saveFinalGenerationToCustomPayloads = () => {
    if (!lineageExport) {
      return;
    }

    const existing = loadCustomPayloadsFromStorage();
    const existingPrompts = new Set(existing.map((payload) => payload.prompt.trim()));
    const stamp = Date.now();

    const evolved = lineageExport.finalPopulation
      .map((payload, index) => {
        const prompt = payload.prompt.trim();
        if (!prompt || existingPrompts.has(prompt)) {
          return null;
        }
        existingPrompts.add(prompt);
        return {
          ...payload,
          id: `evolved-${stamp}-${index + 1}`,
          name: `[Evolved] ${payload.name}`,
          tags: Array.from(new Set([...(payload.tags ?? []), "evolved", "saved-from-evolve"])),
        } as AttackPayload;
      })
      .filter(Boolean) as AttackPayload[];

    if (evolved.length === 0) {
      setSaveNotice("No new evolved payloads to save (all duplicates by prompt).");
      return;
    }

    localStorage.setItem(
      CUSTOM_PAYLOADS_STORAGE_KEY,
      JSON.stringify([...existing, ...evolved])
    );
    setSaveNotice(`Saved ${evolved.length} evolved payload${evolved.length === 1 ? "" : "s"} to custom payloads.`);
  };

  const runEvolution = async () => {
    if (!activeTarget) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setSaveNotice(null);
    setMeta(null);
    setProgress(null);
    setSummaries([]);
    setLineageExport(null);

    try {
      const response = await fetch("/api/evolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: activeTarget.endpoint,
          ...getTargetKeyFields(activeTarget),
          model: activeTarget.model,
          provider: activeTarget.provider,
          categories: selectedCategories,
          concurrency,
          generations,
          topK,
          mutationRate,
          mutationMode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const detail = payload?.missing?.length
          ? ` (${payload.missing.join(", ")})`
          : "";
        const hint = payload?.hint ? ` — ${payload.hint}` : "";
        throw new Error(
          payload && typeof payload.error === "string"
            ? `${payload.error}${detail}${hint}`
            : "Evolution request failed"
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Evolution stream unavailable");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            handleStreamLine(line);
          }
        }
      }

      if (buffer.trim()) {
        handleStreamLine(buffer);
      }
    } catch (streamError: unknown) {
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        setError("Evolution run cancelled.");
      } else {
        setError(
          streamError instanceof Error
            ? streamError.message
            : "Evolution request failed"
        );
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Evolution Runner</h2>
          <p className="text-sm text-muted-foreground">
            Autoresearch-style generations for payload evolution with deterministic or LLM crossover modes.
          </p>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Active Target Context
          </CardTitle>
          <CardDescription>
            Evolution uses the active sidebar target, selected attack categories, and shared concurrency setting.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {activeTarget ? (
            <>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {activeTarget.name}
                </Badge>
                <Badge variant="outline">
                  {activeTarget.provider} / {activeTarget.model}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Zap className="h-3 w-3" />
                  Concurrency {concurrency}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.length > 0 ? (
                  selectedCategories.map((category) => (
                    <Badge key={category} variant="secondary">
                      {CATEGORY_LABELS[category]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Select at least one attack category in the sidebar.
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose an active target in the sidebar before running evolution.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Evolution Controls</CardTitle>
          <CardDescription>
            Generation 0 runs selected payloads as-is. Later generations breed top performers with mutation + crossover.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Generations</span>
              <Input
                type="number"
                min={1}
                max={10}
                value={generations}
                onChange={(event) =>
                  setGenerations(Math.max(1, Math.min(10, Number(event.target.value) || 1)))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Top K</span>
              <Input
                type="number"
                min={1}
                value={topK}
                onChange={(event) =>
                  setTopK(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Mutation Rate</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={mutationRate}
                onChange={(event) =>
                  setMutationRate(
                    Math.max(0, Math.min(1, Number(event.target.value) || 0))
                  )
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Mutation Mode</span>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mutationMode}
                onChange={(event) =>
                  setMutationMode(event.target.value === "llm" ? "llm" : "deterministic")
                }
              >
                <option value="deterministic">Deterministic</option>
                <option value="llm">LLM Crossover</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {running ? (
              <Button
                variant="destructive"
                className="gap-2"
                onClick={stopEvolution}
              >
                Stop Evolution
              </Button>
            ) : (
              <Button
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!canRun}
                onClick={runEvolution}
              >
                <Sparkles className="h-4 w-4" />
                Run Evolution
              </Button>
            )}

            {running && (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress
                  ? `${formatGenerationLabel(progress.generation, progress.totalGenerations)} · ${progress.completed}/${progress.total}`
                  : "Starting evolution stream..."}
              </span>
            )}

            {isRunning && !running && (
              <span className="text-sm text-muted-foreground">
                Finish the active attack run before starting evolution.
              </span>
            )}
          </div>

          {meta && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">
                {meta.initialPayloadCount} payloads
              </Badge>
              <Badge variant="outline">
                {meta.totalGenerations} generations
              </Badge>
              <Badge variant="outline">
                Top {meta.topK}
              </Badge>
              <Badge variant="outline">
                Mutation {meta.mutationRate}
              </Badge>
              <Badge variant="outline">
                Mode {mutationMode}
              </Badge>
            </div>
          )}

          {lineageExport && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadFile(
                    JSON.stringify(lineageExport.jsonExport, null, 2),
                    `centauri-aegis-evolve-lineage-${new Date().toISOString().slice(0, 10)}.json`,
                    "application/json"
                  )
                }
              >
                <Download className="h-4 w-4" />
                Download Lineage JSON
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() =>
                  downloadFile(
                    JSON.stringify(lineageExport.sarifExport, null, 2),
                    `centauri-aegis-evolve-lineage-${new Date().toISOString().slice(0, 10)}.sarif.json`,
                    "application/sarif+json"
                  )
                }
              >
                <Download className="h-4 w-4" />
                Download Lineage SARIF
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={saveFinalGenerationToCustomPayloads}
              >
                <Sparkles className="h-4 w-4" />
                Save Final Generation ({lineageExport.finalPopulation.length})
              </Button>
            </div>
          )}

          {saveNotice && (
            <p className="text-sm text-success">{saveNotice}</p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Generation Summaries
          </CardTitle>
          <CardDescription>
            Each streamed event captures aggregate fitness and top payloads for a generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No generation summaries yet. Run evolution to populate this panel.
            </p>
          ) : (
            <ScrollArea className="max-h-[520px] pr-4">
              <div className="space-y-4">
                {summaries.map((summary) => (
                  <div
                    key={summary.generation}
                    className="rounded-lg border border-border bg-background/50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {formatGenerationLabel(
                            summary.generation,
                            meta?.totalGenerations ?? (summaries.length || 1)
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {summary.successCount}/{summary.totalPayloads} successful payloads
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          Success {formatPercent(summary.successRate)}
                        </Badge>
                        <Badge variant="outline">
                          Avg fitness {summary.avgFitness.toFixed(3)}
                        </Badge>
                        <Badge variant="outline">
                          Severity {summary.avgSeverityNorm.toFixed(3)}
                        </Badge>
                        <Badge variant="outline">
                          Novelty {summary.avgNovelty.toFixed(3)}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {summary.topPayloads.map((payload) => (
                        <div
                          key={payload.payloadId}
                          className="rounded-md border border-border/70 bg-card px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {payload.payloadName}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  payload.success
                                    ? "border-success/50 text-success"
                                    : "border-muted-foreground/40 text-muted-foreground"
                                }
                              >
                                {payload.status}
                              </Badge>
                              <Badge variant="outline">
                                Fitness {payload.fitness.toFixed(3)}
                              </Badge>
                              <Badge variant="outline">
                                {payload.classification}
                              </Badge>
                            </div>
                          </div>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {payload.prompt}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
