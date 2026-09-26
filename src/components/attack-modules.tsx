"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { generateId } from "@/lib/uuid";
import { allPayloads, getPayloadsByCategory } from "@/lib/attacks";
import type { AttackCategory, Severity, ModelTarget, AttackPayload, AttackRun } from "@/lib/types";
import { CATEGORY_LABELS, MODEL_TARGET_LABELS } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getTargetKeyFields } from "@/lib/target-utils";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Puzzle,
  Play,
  Loader2,
  Search,
  X,
  Filter,
  Terminal,
  ShieldOff,
  Database,
  ShieldAlert,
  Wrench,
  GitBranch,
  Binary,
  Layers,
} from "lucide-react";

const CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
  "tool_abuse",
  "multi_turn",
  "encoding",
];

const CATEGORY_DESCRIPTIONS: Record<AttackCategory, string> = {
  injection:
    "Techniques to inject malicious instructions into LLM prompts, overriding system instructions or manipulating behavior.",
  jailbreak:
    "Methods to bypass safety alignment and content policies, coercing the model into unrestricted behavior.",
  extraction:
    "Attacks aimed at extracting system prompts, training data, or sensitive information from the model.",
  bypass:
    "Strategies to evade content filters, safety guardrails, and output restrictions.",
  tool_abuse:
    "Manipulates tool-calling capabilities to enumerate tools, inject parameters, escalate privileges, or hijack agentic workflows.",
  multi_turn:
    "Exploits context-dependent compliance through multi-turn escalation chains that gradually shift from benign to adversarial.",
  encoding:
    "Tests whether encoding or obfuscation techniques can circumvent content filters by hiding instructions in base64, hex, ROT13, unicode, and more.",
};

function CategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category: AttackCategory;
  className?: string;
}) {
  switch (category) {
    case "injection":
      return <Terminal className={className} />;
    case "jailbreak":
      return <ShieldOff className={className} />;
    case "extraction":
      return <Database className={className} />;
    case "bypass":
      return <ShieldAlert className={className} />;
    case "tool_abuse":
      return <Wrench className={className} />;
    case "multi_turn":
      return <GitBranch className={className} />;
    case "encoding":
      return <Binary className={className} />;
  }
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "high":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "medium":
      return "bg-warning/20 text-warning border-warning/30";
    case "low":
      return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30";
  }
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const MODEL_TARGETS: ModelTarget[] = ["universal", "gpt", "claude", "llama"];

function matchesSearch(payload: AttackPayload, query: string): boolean {
  const q = query.toLowerCase();
  return (
    payload.name.toLowerCase().includes(q) ||
    payload.description.toLowerCase().includes(q) ||
    payload.id.toLowerCase().includes(q) ||
    (payload.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
  );
}

export function AttackModules() {
  const { targets, activeTargetId, addRun, addResult, completeRun, isRunning, setIsRunning, setView, setActiveRun } = useStore();
  const [expanded, setExpanded] = useState<Set<AttackCategory>>(new Set());
  const [customPayloads] = useState<AttackPayload[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("centauri-aegis-custom-payloads");
      return stored ? (JSON.parse(stored) as AttackPayload[]) : [];
    } catch {
      return [];
    }
  });
  const [customExpanded, setCustomExpanded] = useState(false);
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<string>>(new Set());
  const [runningCustom, setRunningCustom] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilters, setSeverityFilters] = useState<Set<Severity>>(new Set());
  const [modelTargetFilter, setModelTargetFilter] = useState<ModelTarget | null>(null);

  const hasActiveFilters = searchQuery.length > 0 || severityFilters.size > 0 || modelTargetFilter !== null;

  const clearFilters = () => {
    setSearchQuery("");
    setSeverityFilters(new Set());
    setModelTargetFilter(null);
  };

  const toggleSeverityFilter = (s: Severity) => {
    setSeverityFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // Memoized filtered payloads per category
  const filteredByCategory = useMemo(() => {
    const result: Record<AttackCategory, AttackPayload[]> = {} as Record<AttackCategory, AttackPayload[]>;
    for (const cat of CATEGORIES) {
      let payloads = getPayloadsByCategory(cat);
      if (searchQuery) {
        payloads = payloads.filter((p) => matchesSearch(p, searchQuery));
      }
      if (severityFilters.size > 0) {
        payloads = payloads.filter((p) => severityFilters.has(p.severity));
      }
      if (modelTargetFilter) {
        payloads = payloads.filter((p) => (p.modelTarget ?? "universal") === modelTargetFilter);
      }
      result[cat] = payloads;
    }
    return result;
  }, [searchQuery, severityFilters, modelTargetFilter]);

  const totalFiltered = useMemo(
    () => Object.values(filteredByCategory).reduce((sum, arr) => sum + arr.length, 0),
    [filteredByCategory]
  );

  // Filtered custom payloads
  const filteredCustomPayloads = useMemo(() => {
    let payloads = customPayloads;
    if (searchQuery) {
      payloads = payloads.filter((p) => matchesSearch(p, searchQuery));
    }
    if (severityFilters.size > 0) {
      payloads = payloads.filter((p) => severityFilters.has(p.severity));
    }
    if (modelTargetFilter) {
      payloads = payloads.filter((p) => (p.modelTarget ?? "universal") === modelTargetFilter);
    }
    return payloads;
  }, [customPayloads, searchQuery, severityFilters, modelTargetFilter]);

  const toggleCustomSelect = (id: string) => {
    setSelectedCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCustomIds.size === customPayloads.length) {
      setSelectedCustomIds(new Set());
    } else {
      setSelectedCustomIds(new Set(customPayloads.map((p) => p.id)));
    }
  };

  const runCustomPayloads = async () => {
    const target = targets.find((t) => t.id === activeTargetId);
    if (!target || selectedCustomIds.size === 0) return;

    const payloadsToRun = customPayloads.filter((p) => selectedCustomIds.has(p.id));
    setRunningCustom(true);
    setIsRunning(true);

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: [...new Set(payloadsToRun.map((p) => p.category))],
      results: [],
      startTime: Date.now(),
      status: "running",
    };
    addRun(run);
    setActiveRun(runId);
    setView("results");

    try {
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: target.endpoint,
          ...getTargetKeyFields(target),
          model: target.model,
          provider: target.provider,
          rawPayloads: payloadsToRun,
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
              addResult(runId, JSON.parse(line));
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (err) {
      console.error("Custom payload run failed", err);
    }

    completeRun(runId);
    setRunningCustom(false);
    setIsRunning(false);
  };

  const toggleExpand = (cat: AttackCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Shield className="h-6 w-6 text-primary" />
          Attack Modules
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and explore all available attack payloads across{" "}
          {CATEGORIES.length} categories. Total payloads:{" "}
          <span className="font-mono text-foreground">{allPayloads.length}</span>
        </p>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search payloads by name, description, ID, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 bg-background"
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

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />

            {/* Severity toggles */}
            <span className="text-xs text-muted-foreground mr-1">Severity:</span>
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => toggleSeverityFilter(s)}
                className={`rounded-[2px] px-2 py-0.5 text-[11px] font-mono border transition-colors ${
                  severityFilters.has(s)
                    ? severityColor(s)
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}

            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* Model target toggles */}
            <span className="text-xs text-muted-foreground mr-1">Target:</span>
            {MODEL_TARGETS.map((mt) => (
              <button
                key={mt}
                onClick={() => setModelTargetFilter(modelTargetFilter === mt ? null : mt)}
                className={`rounded-[2px] px-2 py-0.5 text-[11px] font-mono border transition-colors ${
                  modelTargetFilter === mt
                    ? "border-primary/50 bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {MODEL_TARGET_LABELS[mt]}
              </button>
            ))}

            {/* Clear + count */}
            {hasActiveFilters && (
              <>
                <Separator orientation="vertical" className="h-5 mx-1" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">{totalFiltered}</span> / {allPayloads.length} payloads
                </span>
                <button
                  onClick={clearFilters}
                  className="rounded px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {/* Custom Payloads Section */}
        {filteredCustomPayloads.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader
              className="cursor-pointer select-none transition-colors hover:bg-accent/50"
              onClick={() => setCustomExpanded(!customExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-foreground shrink-0">
                    <Puzzle className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      Custom Payloads
                      <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                        {filteredCustomPayloads.length}
                        {hasActiveFilters && filteredCustomPayloads.length !== customPayloads.length && (
                          <span className="text-muted-foreground">/{customPayloads.length}</span>
                        )}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      Payloads you created in the Payload Editor
                    </CardDescription>
                  </div>
                </div>
                {customExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>

            {customExpanded && (
              <CardContent className="pt-0">
                <Separator className="mb-4" />

                <div className="mb-3 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={selectedCustomIds.size === filteredCustomPayloads.length && filteredCustomPayloads.length > 0}
                      onCheckedChange={toggleSelectAll}
                      className="border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    />
                    Select all ({filteredCustomPayloads.length})
                  </label>

                  {selectedCustomIds.size > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 h-7 text-xs"
                      disabled={runningCustom || isRunning || !activeTargetId}
                      onClick={runCustomPayloads}
                    >
                      {runningCustom ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      Run {selectedCustomIds.size} selected
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {filteredCustomPayloads.map((payload) => (
                    <div key={payload.id} className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedCustomIds.has(payload.id)}
                        onCheckedChange={() => toggleCustomSelect(payload.id)}
                        className="mt-3 border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />
                      <div className="flex-1">
                        <PayloadItem
                          name={payload.name}
                          severity={payload.severity}
                          description={payload.description}
                          prompt={payload.prompt}
                          tags={payload.tags}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {CATEGORIES.map((cat) => {
          const payloads = filteredByCategory[cat];
          const totalInCategory = getPayloadsByCategory(cat).length;
          const isExpanded = expanded.has(cat);
          const criticalCount = payloads.filter(
            (p) => p.severity === "critical"
          ).length;
          const highCount = payloads.filter(
            (p) => p.severity === "high"
          ).length;

          // Hide empty categories when filtering
          if (hasActiveFilters && payloads.length === 0) return null;

          return (
            <Card key={cat} className="border-border bg-card">
              <CardHeader
                className="cursor-pointer select-none transition-colors hover:bg-accent/50"
                onClick={() => toggleExpand(cat)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-foreground shrink-0">
                      <CategoryIcon category={cat} className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {CATEGORY_LABELS[cat]}
                      </CardTitle>
                      <CardDescription className="mt-0.5 text-xs">
                        {payloads.length} payload
                        {payloads.length !== 1 ? "s" : ""}
                        {hasActiveFilters && payloads.length !== totalInCategory && (
                          <span className="text-muted-foreground"> / {totalInCategory} total</span>
                        )}
                        {criticalCount > 0 && (
                          <span className="ml-2 text-destructive">
                            {criticalCount} critical
                          </span>
                        )}
                        {highCount > 0 && (
                          <span className="ml-2 text-warning">
                            {highCount} high
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <p className="mb-4 text-sm text-muted-foreground">
                    {CATEGORY_DESCRIPTIONS[cat]}
                  </p>
                  <Separator className="mb-4" />

                  <ScrollArea className={payloads.length > 6 ? "h-[500px]" : ""}>
                    <div className="space-y-2">
                      {payloads.map((payload) => (
                        <PayloadItem
                          key={payload.id}
                          name={payload.name}
                          severity={payload.severity}
                          description={payload.description}
                          prompt={payload.prompt}
                          modelTarget={payload.modelTarget}
                          tags={payload.tags}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* No results message */}
        {hasActiveFilters && totalFiltered === 0 && filteredCustomPayloads.length === 0 && (
          <Card className="border-border bg-card">
            <CardContent className="p-8 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No payloads match your filters.
              </p>
              <button
                onClick={clearFilters}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Clear all filters
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PayloadItem({
  name,
  severity,
  description,
  prompt,
  modelTarget,
  tags,
}: {
  name: string;
  severity: Severity;
  description: string;
  prompt: string;
  modelTarget?: ModelTarget;
  tags?: string[];
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase ${severityColor(severity)}`}
            >
              {severity}
            </Badge>
            {modelTarget && modelTarget !== "universal" && (
              <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">
                {MODEL_TARGET_LABELS[modelTarget]}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {tags && tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {showPrompt ? "Hide" : "View"}
        </button>
      </div>

      {showPrompt && (
        <div className="mt-2 rounded border border-border bg-sidebar p-2">
          <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}
