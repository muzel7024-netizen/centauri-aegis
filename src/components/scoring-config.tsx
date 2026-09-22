// INTEGRATION: Add to store.ts: none (standalone, uses localStorage for rubrics)
// INTEGRATION: Add to types.ts: none (types in scoring.ts)
// INTEGRATION: Add to page.tsx: import ScoringConfig, add view === "scoring" case
// INTEGRATION: Add to sidebar.tsx: add nav item { view: "scoring", icon: Calculator, label: "Scoring" }

"use client";

import { useState, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_RUBRIC,
  scoreRun,
  loadSavedRubrics,
  saveRubric,
  deleteRubric,
  exportRubric,
  importRubric,
  type ScoringRubric,
  type RunScore,
  type RiskLevel,
} from "@/lib/scoring";
import type { AttackCategory, Severity, AnalysisClassification } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calculator,
  Save,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  Copy,
  Award,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: AttackCategory[] = ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const CLASSIFICATIONS: AnalysisClassification[] = [
  "full_jailbreak",
  "information_leakage",
  "partial_compliance",
  "refusal",
  "error",
];

const CLASSIFICATION_LABELS: Record<AnalysisClassification, string> = {
  full_jailbreak: "Full Jailbreak",
  information_leakage: "Info Leakage",
  partial_compliance: "Partial Compliance",
  refusal: "Refusal",
  error: "Error",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "text-redpincer",
  high: "text-warning",
  medium: "text-lobster",
  low: "text-muted-foreground",
  passing: "text-success",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Critical Risk",
  high: "High Risk",
  medium: "Medium Risk",
  low: "Low Risk",
  passing: "Passing",
};

// ---------------------------------------------------------------------------
// Slider component (simple range input)
// ---------------------------------------------------------------------------

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 appearance-none rounded-full bg-muted accent-lobster cursor-pointer"
      />
      <span className="w-12 text-right text-sm font-mono text-muted-foreground">
        {value.toFixed(step < 1 ? 1 : 0)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScoringConfig() {
  const { runs, activeRunId } = useStore();

  const [rubric, setRubric] = useState<ScoringRubric>({ ...DEFAULT_RUBRIC });
  const [savedRubrics, setSavedRubrics] = useState<ScoringRubric[]>(() => loadSavedRubrics());
  const [rubricName, setRubricName] = useState(DEFAULT_RUBRIC.name);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRun = runs.find((r) => r.id === activeRunId);

  // Preview score
  const previewScore: RunScore | null = useMemo(() => {
    if (!activeRun || activeRun.results.length === 0) return null;
    return scoreRun(activeRun, rubric);
  }, [activeRun, rubric]);

  // Update helpers
  const setCategoryWeight = (cat: AttackCategory, value: number) => {
    setRubric((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        categoryWeights: { ...prev.weights.categoryWeights, [cat]: value },
      },
    }));
  };

  const setSeverityMultiplier = (sev: Severity, value: number) => {
    setRubric((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        severityMultipliers: { ...prev.weights.severityMultipliers, [sev]: value },
      },
    }));
  };

  const setClassificationScore = (cls: AnalysisClassification, value: number) => {
    setRubric((prev) => ({
      ...prev,
      weights: {
        ...prev.weights,
        classificationScores: { ...prev.weights.classificationScores, [cls]: value },
      },
    }));
  };

  const setThreshold = (key: keyof ScoringRubric["thresholds"], value: number) => {
    setRubric((prev) => ({
      ...prev,
      thresholds: { ...prev.thresholds, [key]: value },
    }));
  };

  const handleSave = () => {
    const rubricToSave = { ...rubric, name: rubricName };
    saveRubric(rubricToSave);
    setRubric(rubricToSave);
    setSavedRubrics(loadSavedRubrics());
  };

  const handleLoad = (r: ScoringRubric) => {
    setRubric({ ...r });
    setRubricName(r.name);
  };

  const handleDelete = (name: string) => {
    deleteRubric(name);
    setSavedRubrics(loadSavedRubrics());
  };

  const handleReset = () => {
    setRubric({ ...DEFAULT_RUBRIC });
    setRubricName(DEFAULT_RUBRIC.name);
  };

  const handleExport = () => {
    const json = exportRubric({ ...rubric, name: rubricName });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rubric-${rubricName.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const imported = importRubric(importText);
    if (imported) {
      setRubric(imported);
      setRubricName(imported.name);
      setImportText("");
      setShowImport(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const imported = importRubric(text);
      if (imported) {
        setRubric(imported);
        setRubricName(imported.name);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCopyJson = () => {
    const json = exportRubric({ ...rubric, name: rubricName });
    navigator.clipboard.writeText(json);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-lobster" />
        <h2 className="text-2xl font-bold text-foreground">Custom Scoring Rubric</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Configuration */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Rubric Name */}
          <Card className="border-border bg-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="rubric-name" className="text-sm text-muted-foreground">
                  Rubric Name
                </Label>
                <Input
                  id="rubric-name"
                  value={rubricName}
                  onChange={(e) => setRubricName(e.target.value)}
                  className="max-w-xs"
                />
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={handleSave}>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={handleReset}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => setShowImport(!showImport)}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={handleCopyJson}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy JSON
                  </Button>
                </div>
              </div>

              {showImport && (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    className="h-24 w-full rounded-md border border-border bg-background p-2 text-sm font-mono text-foreground"
                    placeholder="Paste rubric JSON here..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleImport}>
                      Import from JSON
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Import from file
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileImport}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Weights */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Category Weights (0-10)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {CATEGORIES.map((cat) => (
                  <SliderControl
                    key={cat}
                    label={CATEGORY_LABELS[cat]}
                    value={rubric.weights.categoryWeights[cat]}
                    min={0}
                    max={10}
                    step={1}
                    onChange={(v) => setCategoryWeight(cat, v)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Severity Multipliers */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Severity Multipliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {SEVERITIES.map((sev) => (
                  <SliderControl
                    key={sev}
                    label={SEVERITY_LABELS[sev]}
                    value={rubric.weights.severityMultipliers[sev]}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onChange={(v) => setSeverityMultiplier(sev, v)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Classification Scores */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Classification Scores (0-100)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {CLASSIFICATIONS.map((cls) => (
                  <SliderControl
                    key={cls}
                    label={CLASSIFICATION_LABELS[cls]}
                    value={rubric.weights.classificationScores[cls]}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) => setClassificationScore(cls, v)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Thresholds */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Risk Thresholds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <SliderControl
                  label="Critical"
                  value={rubric.thresholds.critical}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setThreshold("critical", v)}
                />
                <SliderControl
                  label="High"
                  value={rubric.thresholds.high}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setThreshold("high", v)}
                />
                <SliderControl
                  label="Medium"
                  value={rubric.thresholds.medium}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setThreshold("medium", v)}
                />
                <SliderControl
                  label="Low"
                  value={rubric.thresholds.low}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) => setThreshold("low", v)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview & Saved */}
        <div className="flex flex-col gap-4">
          {/* Score Preview */}
          <Card className="border-lobster/30 bg-card sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-lobster">
                <Award className="h-4 w-4" />
                Score Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewScore ? (
                <div className="flex flex-col gap-4">
                  {/* Overall Score */}
                  <div className="text-center">
                    <p className="text-5xl font-bold text-foreground">
                      {previewScore.overall.toFixed(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </div>

                  {/* Grade */}
                  <div className="flex items-center justify-center gap-3">
                    <div
                      className={`rounded-lg border-2 px-4 py-2 text-center ${
                        previewScore.grade.startsWith("A")
                          ? "border-success text-success"
                          : previewScore.grade.startsWith("B")
                            ? "border-lobster text-lobster"
                            : previewScore.grade.startsWith("C")
                              ? "border-warning text-warning"
                              : "border-redpincer text-redpincer"
                      }`}
                    >
                      <p className="text-3xl font-bold">{previewScore.grade}</p>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={RISK_COLORS[previewScore.riskLevel]}
                      >
                        {RISK_LABELS[previewScore.riskLevel]}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-center text-sm">
                    <div className="rounded border border-border p-2">
                      <p className="text-lg font-bold text-redpincer">{previewScore.breachCount}</p>
                      <p className="text-xs text-muted-foreground">Breached</p>
                    </div>
                    <div className="rounded border border-border p-2">
                      <p className="text-lg font-bold text-foreground">
                        {previewScore.breachRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Breach Rate</p>
                    </div>
                  </div>

                  {/* Category Scores */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Per Category
                    </p>
                    {previewScore.categoryScores.map((cs) => (
                      <div key={cs.category} className="flex items-center gap-2">
                        <span className="w-20 truncate text-xs text-foreground">
                          {CATEGORY_LABELS[cs.category]}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${cs.percentage}%`,
                              backgroundColor:
                                cs.percentage > 60
                                  ? "hsl(var(--redpincer))"
                                  : cs.percentage > 30
                                    ? "hsl(var(--warning))"
                                    : "hsl(var(--success))",
                            }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs text-muted-foreground">
                          {cs.score.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Calculator className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    {activeRun
                      ? "Run has no results yet."
                      : "Select a run from the Results view to preview scoring."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saved Rubrics */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Saved Rubrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedRubrics.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No saved rubrics. Save the current configuration.
                </p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="flex flex-col gap-2">
                    {savedRubrics.map((r) => (
                      <div
                        key={r.name}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span className="flex-1 font-medium text-foreground">{r.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleLoad(r)}
                        >
                          Load
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-redpincer"
                          onClick={() => handleDelete(r.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
