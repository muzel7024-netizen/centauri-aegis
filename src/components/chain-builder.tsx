"use client";
import { generateId } from "@/lib/uuid";

import { useState, useCallback, useReducer } from "react";
import { useStore } from "@/lib/store";
import {
  builtinChains,
  type AttackChain,
  type ChainStep,
  type ChainStepResult,
} from "@/lib/chains";
import type { AttackCategory, Severity } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { getTargetKeyFields } from "@/lib/target-utils";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Link2,
  Play,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Square,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

function severityBadgeClass(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-redpincer/20 text-redpincer border-redpincer/30";
    case "high":
      return "bg-lobster/20 text-lobster border-lobster/30";
    case "medium":
      return "bg-warning/20 text-warning border-warning/30";
    case "low":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
}

function categoryBadgeClass(category: AttackCategory): string {
  switch (category) {
    case "injection":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "jailbreak":
      return "bg-redpincer/20 text-redpincer border-redpincer/30";
    case "extraction":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "bypass":
      return "bg-lobster/20 text-lobster border-lobster/30";
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

// ── Execution State ─────────────────────────────────────────────────────────

interface ChainExecution {
  chainId: string;
  chainName: string;
  status: "idle" | "running" | "completed" | "error";
  currentStep: number; // 0-indexed position in sorted steps
  stepResults: ChainStepResult[];
  totalSteps: number;
  overallSuccess?: boolean;
  startTime?: number;
  endTime?: number;
}

type ExecAction =
  | { type: "start"; chainId: string; chainName: string; totalSteps: number }
  | { type: "step_result"; result: ChainStepResult }
  | {
      type: "summary";
      overallSuccess: boolean;
      endTime: number;
    }
  | { type: "error"; error: string }
  | { type: "reset" };

function execReducer(state: ChainExecution, action: ExecAction): ChainExecution {
  switch (action.type) {
    case "start":
      return {
        chainId: action.chainId,
        chainName: action.chainName,
        status: "running",
        currentStep: 0,
        stepResults: [],
        totalSteps: action.totalSteps,
        startTime: Date.now(),
      };
    case "step_result":
      return {
        ...state,
        currentStep: state.stepResults.length + 1,
        stepResults: [...state.stepResults, action.result],
      };
    case "summary":
      return {
        ...state,
        status: "completed",
        overallSuccess: action.overallSuccess,
        endTime: action.endTime,
      };
    case "error":
      return { ...state, status: "error" };
    case "reset":
      return initialExecution;
    default:
      return state;
  }
}

const initialExecution: ChainExecution = {
  chainId: "",
  chainName: "",
  status: "idle",
  currentStep: 0,
  stepResults: [],
  totalSteps: 0,
};

// ── Main Component ──────────────────────────────────────────────────────────

export function ChainBuilder() {
  const { targets, activeTargetId } = useStore();
  const target = targets.find((t) => t.id === activeTargetId);

  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  const [exec, dispatch] = useReducer(execReducer, initialExecution);
  const [customChains, setCustomChains] = useState<AttackChain[]>([]);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const allChains = [...builtinChains, ...customChains];

  const runChain = useCallback(
    async (chain: AttackChain) => {
      if (!target) return;

      const controller = new AbortController();
      setAbortController(controller);

      dispatch({
        type: "start",
        chainId: chain.id,
        chainName: chain.name,
        totalSteps: chain.steps.length,
      });

      try {
        const res = await fetch("/api/chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: target.endpoint,
            ...getTargetKeyFields(target),
            model: target.model,
            provider: target.provider,
            chain,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          dispatch({ type: "error", error: err.error });
          return;
        }

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
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.type === "step_result") {
                dispatch({ type: "step_result", result: data });
              } else if (data.type === "summary") {
                dispatch({
                  type: "summary",
                  overallSuccess: data.overallSuccess,
                  endTime: data.endTime,
                });
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          dispatch({ type: "summary", overallSuccess: false, endTime: Date.now() });
        } else {
          dispatch({ type: "error", error: "Chain execution failed" });
        }
      } finally {
        setAbortController(null);
      }
    },
    [target],
  );

  const stopChain = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Link2 className="h-6 w-6 text-redpincer" />
          Attack Chains
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Multi-step attack sequences where each step builds on previous
          responses.
          {!target && (
            <span className="ml-2 text-warning">
              Select a target to run chains.
            </span>
          )}
        </p>
      </div>

      {/* Execution View (when running or completed) */}
      {exec.status !== "idle" && (
        <ChainExecutionView exec={exec} onReset={() => dispatch({ type: "reset" })} onStop={stopChain} />
      )}

      {/* Built-in Chains */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Built-in Chains
        </h3>
        {builtinChains.map((chain) => (
          <ChainCard
            key={chain.id}
            chain={chain}
            expanded={expandedChain === chain.id}
            onToggle={() =>
              setExpandedChain(expandedChain === chain.id ? null : chain.id)
            }
            onRun={() => runChain(chain)}
            canRun={!!target && exec.status !== "running"}
          />
        ))}
      </div>

      {/* Custom Chains */}
      {customChains.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Custom Chains
          </h3>
          {customChains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              expanded={expandedChain === chain.id}
              onToggle={() =>
                setExpandedChain(expandedChain === chain.id ? null : chain.id)
              }
              onRun={() => runChain(chain)}
              canRun={!!target && exec.status !== "running"}
              onDelete={() =>
                setCustomChains((prev) => prev.filter((c) => c.id !== chain.id))
              }
            />
          ))}
        </div>
      )}

      <Separator />

      {/* Custom Chain Builder */}
      {showCustomBuilder ? (
        <CustomChainEditor
          onSave={(chain) => {
            setCustomChains((prev) => [...prev, chain]);
            setShowCustomBuilder(false);
          }}
          onCancel={() => setShowCustomBuilder(false)}
        />
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2 border-dashed text-muted-foreground hover:text-foreground"
          onClick={() => setShowCustomBuilder(true)}
        >
          <Plus className="h-4 w-4" />
          Create Custom Chain
        </Button>
      )}
    </div>
  );
}

// ── Chain Card ───────────────────────────────────────────────────────────────

function ChainCard({
  chain,
  expanded,
  onToggle,
  onRun,
  canRun,
  onDelete,
}: {
  chain: AttackChain;
  expanded: boolean;
  onToggle: () => void;
  onRun: () => void;
  canRun: boolean;
  onDelete?: () => void;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader
        className="cursor-pointer select-none transition-colors hover:bg-accent/50"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{chain.name}</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                {chain.steps.length} steps
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] ${categoryBadgeClass(chain.category)}`}
            >
              {CATEGORY_LABELS[chain.category]}
            </Badge>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase ${severityBadgeClass(chain.severity)}`}
            >
              {chain.severity}
            </Badge>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <p className="mb-4 text-sm text-muted-foreground">
            {chain.description}
          </p>
          <Separator className="mb-4" />

          {/* Step Flow */}
          <div className="mb-4 space-y-2">
            {chain.steps
              .sort((a, b) => a.order - b.order)
              .map((step, idx) => (
                <div key={step.id}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-mono text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{step.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                      <pre className="mt-1 rounded border border-border bg-sidebar p-2 font-mono text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {step.prompt}
                      </pre>
                      {step.useResponseFrom && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Uses response from step{" "}
                          <span className="font-mono text-foreground">
                            {step.useResponseFrom}
                          </span>
                          {step.transformResponse &&
                            step.transformResponse !== "full" && (
                              <>
                                {" "}
                                (transform:{" "}
                                <span className="text-lobster">
                                  {step.transformResponse}
                                </span>
                                )
                              </>
                            )}
                        </p>
                      )}
                    </div>
                  </div>
                  {idx < chain.steps.length - 1 && (
                    <div className="ml-3 border-l border-border pl-0 h-3" />
                  )}
                </div>
              ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-redpincer text-redpincer-foreground hover:bg-redpincer/90"
              disabled={!canRun}
              onClick={(e) => {
                e.stopPropagation();
                onRun();
              }}
            >
              <Play className="h-3.5 w-3.5" />
              Run Chain
            </Button>
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground hover:text-redpincer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Chain Execution View ────────────────────────────────────────────────────

function ChainExecutionView({
  exec,
  onReset,
  onStop,
}: {
  exec: ChainExecution;
  onReset: () => void;
  onStop: () => void;
}) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {exec.status === "running" && (
                <Loader2 className="h-4 w-4 animate-spin text-warning" />
              )}
              {exec.status === "completed" && exec.overallSuccess && (
                <Check className="h-4 w-4 text-redpincer" />
              )}
              {exec.status === "completed" && !exec.overallSuccess && (
                <X className="h-4 w-4 text-success" />
              )}
              {exec.status === "error" && (
                <X className="h-4 w-4 text-redpincer" />
              )}
              {exec.chainName}
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {exec.status === "running" &&
                `Step ${Math.min(exec.currentStep + 1, exec.totalSteps)} of ${exec.totalSteps}`}
              {exec.status === "completed" &&
                `Completed ${exec.stepResults.length}/${exec.totalSteps} steps`}
              {exec.status === "error" && "Chain execution failed"}
              {exec.endTime && exec.startTime && (
                <span className="ml-2 font-mono">
                  {((exec.endTime - exec.startTime) / 1000).toFixed(1)}s total
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {exec.status === "running" && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onStop}>
                <Square className="h-3 w-3" />
                Stop
              </Button>
            )}
            {exec.status !== "running" && (
              <Button size="sm" variant="outline" onClick={onReset}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Step Progress Flow */}
        <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-2">
          {Array.from({ length: exec.totalSteps }).map((_, idx) => {
            const result = exec.stepResults[idx];
            const isCurrent =
              exec.status === "running" && idx === exec.stepResults.length;
            const isPending = !result && !isCurrent;

            return (
              <div key={idx} className="flex items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-mono transition-all ${
                    result?.status === "success"
                      ? "border-success bg-success/20 text-success"
                      : result?.status === "error" || result?.status === "fail"
                        ? "border-redpincer bg-redpincer/20 text-redpincer"
                        : isCurrent
                          ? "border-warning bg-warning/20 text-warning animate-pulse"
                          : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {result?.status === "success" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : result?.status === "error" || result?.status === "fail" ? (
                    <X className="h-3.5 w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    idx + 1
                  )}
                </div>
                {idx < exec.totalSteps - 1 && (
                  <ChevronRight
                    className={`mx-0.5 h-3.5 w-3.5 shrink-0 ${
                      result ? "text-muted-foreground" : "text-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Results */}
        <ScrollArea className={exec.stepResults.length > 3 ? "h-[400px]" : ""}>
          <div className="space-y-2">
            {exec.stepResults.map((result) => {
              const isExpanded = expandedStep === result.stepId;

              return (
                <div
                  key={result.stepId}
                  className={`rounded-lg border transition-colors ${
                    result.status === "success"
                      ? "border-l-2 border-l-success border-t-border border-r-border border-b-border"
                      : "border-l-2 border-l-redpincer border-t-border border-r-border border-b-border"
                  } bg-background`}
                >
                  <button
                    onClick={() =>
                      setExpandedStep(isExpanded ? null : result.stepId)
                    }
                    className="flex w-full items-center gap-3 p-3 text-left"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {result.status === "success" ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-redpincer" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        Step {result.order}: {result.stepName}
                      </span>
                    </div>
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
                    <div className="space-y-3 border-t border-border px-4 py-3">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Prompt Sent
                        </p>
                        <pre className="whitespace-pre-wrap rounded border border-border bg-sidebar p-2 font-mono text-xs text-muted-foreground">
                          {result.prompt}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Response
                        </p>
                        <pre className="whitespace-pre-wrap rounded border border-border bg-sidebar p-2 font-mono text-xs text-muted-foreground">
                          {result.response || result.error || "(empty)"}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Current running step placeholder */}
            {exec.status === "running" &&
              exec.stepResults.length < exec.totalSteps && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-warning" />
                  <span className="text-sm text-muted-foreground">
                    Executing step {exec.stepResults.length + 1} of{" "}
                    {exec.totalSteps}...
                  </span>
                </div>
              )}
          </div>
        </ScrollArea>

        {/* Overall result */}
        {exec.status === "completed" && (
          <>
            <Separator className="my-3" />
            <div
              className={`rounded-lg border p-3 text-sm ${
                exec.overallSuccess
                  ? "border-redpincer/30 bg-redpincer/10 text-redpincer"
                  : "border-success/30 bg-success/10 text-success"
              }`}
            >
              {exec.overallSuccess
                ? "Chain completed successfully \u2014 all steps executed without refusal. Manual review recommended."
                : "Chain blocked or errored \u2014 the target's safety measures held."}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Custom Chain Editor ─────────────────────────────────────────────────────

interface DraftStep {
  id: string;
  name: string;
  prompt: string;
  systemPrompt: string;
}

function CustomChainEditor({
  onSave,
  onCancel,
}: {
  onSave: (chain: AttackChain) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AttackCategory>("extraction");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [steps, setSteps] = useState<DraftStep[]>([
    { id: generateId(), name: "Step 1", prompt: "", systemPrompt: "" },
  ]);

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: generateId(),
        name: `Step ${prev.length + 1}`,
        prompt: "",
        systemPrompt: "",
      },
    ]);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const updateStep = (id: string, field: keyof DraftStep, value: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const canSave =
    name.trim().length > 0 &&
    steps.length > 0 &&
    steps.every((s) => s.prompt.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;

    const chain: AttackChain = {
      id: `custom-${generateId().slice(0, 8)}`,
      name: name.trim(),
      description: description.trim() || "Custom attack chain",
      category,
      severity,
      steps: steps.map((s, idx) => ({
        id: `custom-step-${idx + 1}`,
        order: idx + 1,
        name: s.name.trim() || `Step ${idx + 1}`,
        description: "",
        prompt: s.prompt,
        systemPrompt: s.systemPrompt || undefined,
        useResponseFrom:
          idx > 0 ? `custom-step-${idx}` : undefined,
        transformResponse: "full" as const,
      })),
    };

    onSave(chain);
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-muted-foreground" />
          Create Custom Chain
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chain metadata */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Chain Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Chain"
              className="bg-background"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this chain does..."
              className="bg-background"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AttackCategory)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="injection">Prompt Injection</option>
              <option value="jailbreak">Jailbreak</option>
              <option value="extraction">Data Extraction</option>
              <option value="bypass">Guardrail Bypass</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <Separator />

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Steps
            </h4>
            <span className="text-[10px] text-muted-foreground">
              Use {"{{previous_response}}"} to reference the previous step&apos;s
              response
            </span>
          </div>

          {steps.map((step, idx) => (
            <div
              key={step.id}
              className="rounded-lg border border-border bg-background p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-mono text-muted-foreground">
                  {idx + 1}
                </span>
                <Input
                  value={step.name}
                  onChange={(e) => updateStep(step.id, "name", e.target.value)}
                  placeholder="Step name"
                  className="h-7 bg-card text-sm"
                />
                <div className="flex shrink-0 gap-0.5">
                  <button
                    onClick={() => moveStep(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveStep(idx, 1)}
                    disabled={idx === steps.length - 1}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeStep(step.id)}
                    disabled={steps.length <= 1}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-redpincer disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <Textarea
                value={step.prompt}
                onChange={(e) => updateStep(step.id, "prompt", e.target.value)}
                placeholder="Enter the prompt for this step... Use {{previous_response}} to inject the previous step's response."
                className="min-h-[80px] bg-card font-mono text-xs"
              />

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  System prompt (optional)
                </summary>
                <Textarea
                  value={step.systemPrompt}
                  onChange={(e) =>
                    updateStep(step.id, "systemPrompt", e.target.value)
                  }
                  placeholder="Optional system prompt for this step..."
                  className="mt-1 min-h-[60px] bg-card font-mono text-xs"
                />
              </details>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 border-dashed text-muted-foreground"
            onClick={addStep}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Step
          </Button>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 bg-redpincer text-redpincer-foreground hover:bg-redpincer/90"
            disabled={!canSave}
            onClick={handleSave}
          >
            <Check className="h-3.5 w-3.5" />
            Save Chain
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
