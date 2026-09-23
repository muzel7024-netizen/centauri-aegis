"use client";
import { generateId } from "@/lib/uuid";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { allPayloads } from "@/lib/attacks";
import type {
  AttackPayload,
  AttackCategory,
  AttackRun,
  Severity,
  ModelTarget,
} from "@/lib/types";
import { CATEGORY_LABELS, MODEL_TARGET_LABELS } from "@/lib/types";
import { getTargetKeyFields, getConfigRequestFields } from "@/lib/target-utils";
import {
  generateVariantsForCategory,
  type PayloadVariant,
  type VariantCategory,
  VARIANT_LABELS,
} from "@/lib/variants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Edit3,
  Plus,
  Trash2,
  Copy,
  Play,
  Wand2,
  ChevronDown,
  ChevronRight,
  Tag,
  X,
  Save,
  Download,
  Upload,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "centauri-aegis-custom-payloads";
const LEGACY_STORAGE_KEY = "redpincer-custom-payloads"; // Legacy compatibility only — do not use for new deployments.

const CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const MODEL_TARGETS: ModelTarget[] = ["gpt", "claude", "llama", "universal"];

const VARIANT_CATEGORIES: { key: VariantCategory; label: string }[] = [
  { key: "case", label: "Case" },
  { key: "unicode", label: "Unicode" },
  { key: "encoding", label: "Encoding" },
  { key: "whitespace", label: "Whitespace" },
  { key: "separator", label: "Separator" },
  { key: "language", label: "Language" },
];

// Syntax highlighting keyword groups
const HIGHLIGHT_RULES: { pattern: RegExp; className: string }[] = [
  {
    pattern: /\b(ignore|override|bypass|disregard|forget)\b/gi,
    className: "text-destructive",
  },
  {
    pattern:
      /\b(system prompt|instructions|guidelines|restrictions)\b/gi,
    className: "text-amber-400",
  },
  {
    pattern: /\b(hypothetically|imagine|pretend|roleplay)\b/gi,
    className: "text-warning",
  },
  {
    pattern: /\{\{[^}]+\}\}/g,
    className: "text-success",
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function severityColor(severity: Severity): string {
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

function categoryColor(category: AttackCategory): string {
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

function modelTargetColor(target: ModelTarget): string {
  switch (target) {
    case "gpt":
      return "bg-success/20 text-success border-success/30";
    case "claude":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "llama":
      return "bg-primary/20 text-primary border-primary/30";
    case "universal":
      return "bg-muted text-muted-foreground border-border";
  }
}

function loadCustomPayloads(): AttackPayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomPayloads(payloads: AttackPayload[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payloads));
}

/** Render highlighted text as React elements. */
function highlightPrompt(text: string): React.ReactNode[] {
  if (!text) return [];

  // Build a flat list of regions: { start, end, className | null }
  type Region = { start: number; end: number; className: string };
  const matches: Region[] = [];

  for (const rule of HIGHLIGHT_RULES) {
    // Reset the regex lastIndex since they're global
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        className: rule.className,
      });
    }
  }

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlaps - keep earlier match
  const filtered: Region[] = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  // Build React nodes
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i];
    if (cursor < m.start) {
      nodes.push(text.slice(cursor, m.start));
    }
    nodes.push(
      <span key={`hl-${i}`} className={m.className + " font-semibold"}>
        {text.slice(m.start, m.end)}
      </span>,
    );
    cursor = m.end;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

// ── Empty payload factory ───────────────────────────────────────────────────

function emptyForm(): {
  name: string;
  category: AttackCategory;
  severity: Severity;
  modelTarget: ModelTarget;
  tags: string[];
  description: string;
  prompt: string;
  systemPrompt: string;
} {
  return {
    name: "",
    category: "injection",
    severity: "medium",
    modelTarget: "universal",
    tags: [],
    description: "",
    prompt: "",
    systemPrompt: "",
  };
}

// ── HighlightedEditor sub-component ─────────────────────────────────────────

function HighlightedEditor({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && previewRef.current) {
      previewRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Build line-numbered highlighted preview
  const lines = value.split("\n");

  return (
    <div className="rounded-md border border-border bg-background">
      {/* Textarea for input */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows ?? 8}
        spellCheck={false}
        className="w-full resize-y bg-transparent px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />

      {/* Highlighted preview with line numbers */}
      {value.length > 0 && (
        <>
          <Separator />
          <div
            ref={previewRef}
            className="max-h-[200px] overflow-auto p-2"
          >
            <div className="font-mono text-xs">
              {lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-3 inline-block w-6 shrink-0 select-none text-right text-muted-foreground/50">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre-wrap break-all text-muted-foreground">
                    {highlightPrompt(line)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Character count */}
      <div className="flex justify-end border-t border-border px-3 py-1">
        <span className="text-[10px] text-muted-foreground">
          {value.length} chars
        </span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PayloadEditor() {
  // Zustand store for running attacks
  const {
    targets,
    activeTargetId,
    addRun,
    addResult,
    completeRun,
    setActiveRun,
    setIsRunning,
    setView,
    isRunning,
    redTeamConfig,
  } = useStore();

  // Local state
  const [customPayloads, setCustomPayloads] = useState<AttackPayload[]>(
    loadCustomPayloads,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");

  // Variant state
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [selectedVarCats, setSelectedVarCats] = useState<Set<VariantCategory>>(
    new Set(),
  );
  const [generatedVariants, setGeneratedVariants] = useState<PayloadVariant[]>(
    [],
  );

  // System prompt collapsible
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importSearch, setImportSearch] = useState("");

  // Running state for single-payload runs
  const [runningPayload, setRunningPayload] = useState(false);

  // AI generation state
  const [generating, setGenerating] = useState(false);

  // Persist custom payloads to localStorage
  const updateCustomPayloads = useCallback(
    (updater: (prev: AttackPayload[]) => AttackPayload[]) => {
      setCustomPayloads((prev) => {
        const next = updater(prev);
        saveCustomPayloads(next);
        return next;
      });
    },
    [],
  );

  // ── Handlers ────────────────────────────────────────────────────────────

  const selectPayload = (payload: AttackPayload) => {
    setEditingId(payload.id);
    setForm({
      name: payload.name,
      category: payload.category,
      severity: payload.severity,
      modelTarget: payload.modelTarget ?? "universal",
      tags: payload.tags ?? [],
      description: payload.description,
      prompt: payload.prompt,
      systemPrompt: payload.systemPrompt ?? "",
    });
    setSystemPromptOpen(!!payload.systemPrompt);
    setGeneratedVariants([]);
  };

  const deletePayload = (id: string) => {
    updateCustomPayloads((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyForm());
    }
    toast.success("Payload deleted");
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setGeneratedVariants([]);
    setSystemPromptOpen(false);
  };

  const savePayload = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.prompt.trim()) {
      toast.error("Prompt is required");
      return;
    }

    if (editingId) {
      // Update existing
      updateCustomPayloads((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                name: form.name.trim(),
                category: form.category,
                severity: form.severity,
                modelTarget: form.modelTarget,
                tags: form.tags,
                description: form.description.trim(),
                prompt: form.prompt,
                systemPrompt: form.systemPrompt || undefined,
              }
            : p,
        ),
      );
      toast.success("Payload updated");
    } else {
      // Create new
      const newPayload: AttackPayload = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: form.name.trim(),
        category: form.category,
        severity: form.severity,
        modelTarget: form.modelTarget,
        tags: form.tags,
        description: form.description.trim(),
        prompt: form.prompt,
        systemPrompt: form.systemPrompt || undefined,
      };
      updateCustomPayloads((prev) => [newPayload, ...prev]);
      setEditingId(newPayload.id);
      toast.success("Payload created");
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  // ── Variant generation ──────────────────────────────────────────────────

  const generateVariants = () => {
    if (!form.prompt.trim()) {
      toast.error("Write a prompt first");
      return;
    }
    if (selectedVarCats.size === 0) {
      toast.error("Select at least one variant category");
      return;
    }

    const tempPayload: AttackPayload = {
      id: editingId ?? "temp",
      name: form.name || "Untitled",
      category: form.category,
      severity: form.severity,
      description: form.description,
      prompt: form.prompt,
    };

    const variants = generateVariantsForCategory(
      tempPayload,
      Array.from(selectedVarCats),
    );
    setGeneratedVariants(variants);
    toast.success(`Generated ${variants.length} variants`);
  };

  const variantToPayload = (variant: PayloadVariant) => {
    const newPayload: AttackPayload = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: variant.name,
      category: form.category,
      severity: form.severity,
      description: variant.description,
      prompt: variant.prompt,
      tags: [...form.tags, variant.variantType],
      modelTarget: form.modelTarget,
    };
    updateCustomPayloads((prev) => [newPayload, ...prev]);
    toast.success(`Variant saved as custom payload`);
  };

  // ── Generate with AI ────────────────────────────────────────────────────

  const generateWithAI = async () => {
    if (!redTeamConfig) {
      toast.error("Configure a Red Team LLM to use AI generation");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/generate-payload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getConfigRequestFields(redTeamConfig),
          category: form.category,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to generate payload");
        return;
      }

      const generated = data.payload;
      setForm((f) => ({
        ...f,
        name: generated.name || f.name,
        description: generated.description || f.description,
        severity: generated.severity || f.severity,
        prompt: generated.prompt || f.prompt,
        systemPrompt: generated.systemPrompt || f.systemPrompt,
        tags: generated.tags?.length ? generated.tags : f.tags,
      }));
      setEditingId(null);
      if (generated.systemPrompt) setSystemPromptOpen(true);
      toast.success("Payload generated with AI");
    } catch (err) {
      console.error("AI generation failed:", err);
      toast.error("AI generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Run selected payload ────────────────────────────────────────────────

  const runSelected = async () => {
    if (!editingId) {
      toast.error("Save the payload first");
      return;
    }

    const target = targets.find((t) => t.id === activeTargetId);
    if (!target) {
      toast.error("No active target configured");
      return;
    }

    const payload = customPayloads.find((p) => p.id === editingId);
    if (!payload) {
      toast.error("Payload not found");
      return;
    }

    setRunningPayload(true);
    setIsRunning(true);

    const runId = generateId();
    const run: AttackRun = {
      id: runId,
      targetId: target.id,
      targetName: target.name,
      categories: [payload.category],
      results: [],
      startTime: Date.now(),
      status: "running",
    };

    addRun(run);
    setActiveRun(runId);

    try {
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: target.endpoint,
          ...getTargetKeyFields(target),
          model: target.model,
          provider: target.provider,
          payloadIds: [payload.id],
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
              const result = JSON.parse(line);
              addResult(runId, result);
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch (err) {
      console.error("Attack run failed:", err);
      toast.error("Attack run failed");
    } finally {
      completeRun(runId);
      setIsRunning(false);
      setRunningPayload(false);
      setView("results");
    }
  };

  // ── Import from library ─────────────────────────────────────────────────

  const filteredLibraryPayloads = useMemo(() => {
    if (!importSearch.trim()) return allPayloads;
    const q = importSearch.toLowerCase();
    return allPayloads.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [importSearch]);

  const importPayload = (payload: AttackPayload) => {
    setForm({
      name: `${payload.name} (Custom)`,
      category: payload.category,
      severity: payload.severity,
      modelTarget: payload.modelTarget ?? "universal",
      tags: payload.tags ?? [],
      description: payload.description,
      prompt: payload.prompt,
      systemPrompt: payload.systemPrompt ?? "",
    });
    setEditingId(null); // Will create new on save
    setSystemPromptOpen(!!payload.systemPrompt);
    setImportOpen(false);
    toast.success("Loaded into editor - edit and save to create custom payload");
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Edit3 className="h-6 w-6 text-primary" />
          Payload Editor
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create, edit, and manage custom attack payloads with syntax
          highlighting and variant generation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── Left panel: Custom payload list ────────────────────────── */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Custom Payloads</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {customPayloads.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={clearForm}
            >
              <Plus className="h-3.5 w-3.5" />
              New Payload
            </Button>

            <ScrollArea className={customPayloads.length > 5 ? "h-[400px]" : ""}>
              <div className="space-y-1">
                {customPayloads.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground italic">
                    No custom payloads yet
                  </p>
                )}
                {customPayloads.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm transition-colors hover:bg-accent/50 ${
                      editingId === p.id
                        ? "bg-accent/50 ring-1 ring-primary/30"
                        : ""
                    }`}
                    onClick={() => selectPayload(p)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase ${categoryColor(p.category)}`}
                        >
                          {p.category}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase ${severityColor(p.severity)}`}
                        >
                          {p.severity}
                        </Badge>
                        {p.modelTarget && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase ${modelTargetColor(p.modelTarget)}`}
                          >
                            {MODEL_TARGET_LABELS[p.modelTarget]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePayload(p.id);
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ── Right panel: Editor form ───────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {editingId ? "Edit Payload" : "New Payload"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {/* Row: Name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name *
                </label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Custom System Prompt Extraction"
                  className="bg-background"
                />
              </div>

              {/* Row: Category / Severity / Model Target */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Category
                  </label>
                  <Select
                    value={form.category}
                    onValueChange={(v: AttackCategory) =>
                      setForm((f) => ({ ...f, category: v }))
                    }
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Severity
                  </label>
                  <Select
                    value={form.severity}
                    onValueChange={(v: Severity) =>
                      setForm((f) => ({ ...f, severity: v }))
                    }
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <span className="capitalize">{s}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Model Target
                  </label>
                  <Select
                    value={form.modelTarget}
                    onValueChange={(v: ModelTarget) =>
                      setForm((f) => ({ ...f, modelTarget: v }))
                    }
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_TARGETS.map((mt) => (
                        <SelectItem key={mt} value={mt}>
                          {MODEL_TARGET_LABELS[mt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
                  {form.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 text-[10px]"
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 rounded-full hover:bg-accent"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={
                      form.tags.length === 0 ? "Type a tag, press Enter" : ""
                    }
                    className="min-w-[100px] flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="What this payload tests and why..."
                  rows={2}
                  className="bg-background"
                />
              </div>

              {/* Prompt - main editor */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Prompt *
                </label>
                <HighlightedEditor
                  value={form.prompt}
                  onChange={(v) => setForm((f) => ({ ...f, prompt: v }))}
                  placeholder="Enter your attack payload prompt..."
                  rows={8}
                />
              </div>

              {/* System Prompt - collapsible */}
              <div>
                <button
                  onClick={() => setSystemPromptOpen(!systemPromptOpen)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {systemPromptOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  System Prompt (Optional)
                </button>
                {systemPromptOpen && (
                  <div className="mt-2">
                    <HighlightedEditor
                      value={form.systemPrompt}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, systemPrompt: v }))
                      }
                      placeholder="Optional system prompt for this payload..."
                      rows={4}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={savePayload}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" />
                  {editingId ? "Update Payload" : "Save Payload"}
                </Button>

                <Button
                  variant="outline"
                  onClick={runSelected}
                  disabled={
                    !editingId || !activeTargetId || isRunning || runningPayload
                  }
                  className="gap-2"
                >
                  {runningPayload ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run Selected
                </Button>

                <Button
                  variant="outline"
                  onClick={generateWithAI}
                  disabled={!redTeamConfig || generating}
                  title={!redTeamConfig ? "Configure a Red Team LLM to use AI features" : undefined}
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generating ? "Generating..." : "Generate with AI"}
                </Button>

                <Button variant="ghost" onClick={clearForm} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setImportOpen(true)}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                  Import from Library
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Variant Generator Section ────────────────────────────── */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-0">
              <button
                onClick={() => setVariantsOpen(!variantsOpen)}
                className="flex w-full items-center justify-between"
              >
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Generate Variants
                </CardTitle>
                {variantsOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CardHeader>

            {variantsOpen && (
              <CardContent className="space-y-4 pt-4">
                {/* Category checkboxes */}
                <div className="flex flex-wrap gap-3">
                  {VARIANT_CATEGORIES.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedVarCats.has(key)}
                        onCheckedChange={(checked) => {
                          setSelectedVarCats((prev) => {
                            const next = new Set(prev);
                            if (checked) {
                              next.add(key);
                            } else {
                              next.delete(key);
                            }
                            return next;
                          });
                        }}
                        className="border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <Button
                  onClick={generateVariants}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={!form.prompt.trim() || selectedVarCats.size === 0}
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Generate
                </Button>

                {/* Generated variants */}
                {generatedVariants.length > 0 && (
                  <div className="space-y-2">
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      {generatedVariants.length} variants generated
                    </p>
                    <ScrollArea
                      className={
                        generatedVariants.length > 3 ? "h-[400px]" : ""
                      }
                    >
                      <div className="space-y-2">
                        {generatedVariants.map((v) => (
                          <div
                            key={v.id}
                            className="rounded-lg border border-border bg-background p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {v.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] uppercase"
                                  >
                                    {VARIANT_LABELS[v.variantType]}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {v.description}
                                </p>
                              </div>
                            </div>

                            {/* Preview (truncated to 3 lines) */}
                            <div className="mt-2 rounded border border-border bg-sidebar p-2">
                              <pre className="line-clamp-3 whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                                {v.prompt}
                              </pre>
                            </div>

                            {/* Actions */}
                            <div className="mt-2 flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(v.prompt);
                                  toast.success("Copied to clipboard");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                                Copy
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => variantToPayload(v)}
                              >
                                <Upload className="h-3 w-3" />
                                Use as Payload
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* ── Import from Library Dialog ────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[80vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from Library</DialogTitle>
            <DialogDescription>
              Select a built-in payload to load into the editor for
              customization.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={importSearch}
            onChange={(e) => setImportSearch(e.target.value)}
            placeholder="Search payloads..."
            className="bg-background"
          />

          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {filteredLibraryPayloads.map((p) => (
                <button
                  key={p.id}
                  onClick={() => importPayload(p)}
                  className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase ${categoryColor(p.category)}`}
                      >
                        {p.category}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase ${severityColor(p.severity)}`}
                      >
                        {p.severity}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </div>
                </button>
              ))}
              {filteredLibraryPayloads.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No payloads match your search
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
