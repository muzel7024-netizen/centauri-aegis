"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type {
  AttackCategory,
  Assessment,
  AssessmentConfig,
} from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { allPayloads } from "@/lib/attacks";
import { VARIANT_LABELS } from "@/lib/variants";
import { generateId } from "@/lib/uuid";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Target,
  ArrowRight,
  ArrowLeft,
  Play,
  Save,
  CheckCircle2,
  Sparkles,
  Brain,
  Layers,
  Zap,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface AssessmentWizardProps {
  onClose: () => void;
  onLaunch: (assessmentId: string) => void;
  initialTargetId?: string | null;
}

const ALL_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
  "tool_abuse",
  "multi_turn",
  "encoding",
];

export function AssessmentWizard({
  onClose,
  onLaunch,
  initialTargetId,
}: AssessmentWizardProps) {
  const { targets, activeTargetId, addAssessment, concurrency } = useStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Target
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    initialTargetId || activeTargetId || targets[0]?.id || ""
  );

  // Step 2: Assessment Scope & Details
  const selectedTarget = targets.find((t) => t.id === selectedTargetId);
  const [name, setName] = useState(
    selectedTarget ? `${selectedTarget.name} - Security Assessment` : "New Assessment"
  );
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<AttackCategory[]>([...ALL_CATEGORIES]);
  const [includeVariants, setIncludeVariants] = useState(false);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(false);
  const [evolveEnabled, setEvolveEnabled] = useState(false);
  const [runConcurrency, setRunConcurrency] = useState(concurrency);

  const toggleCategory = (cat: AttackCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const selectAllCategories = () => setCategories([...ALL_CATEGORIES]);
  const deselectAllCategories = () => setCategories([]);

  // Calculate real test count reliably based on actual available payloads
  const basePayloadCount = allPayloads.filter((p) =>
    categories.includes(p.category)
  ).length;

  const totalVariantTypes = Object.keys(VARIANT_LABELS).length;
  // If variants enabled, each base payload can generate variants
  const estimatedTestCount = includeVariants
    ? basePayloadCount * (1 + totalVariantTypes)
    : basePayloadCount;

  const handleSaveDraft = () => {
    if (!selectedTarget) {
      toast.error("Please select a target");
      return;
    }

    const config: AssessmentConfig = {
      categories,
      payloadSelection: "all",
      includeVariants,
      adaptiveEnabled,
      evolveEnabled,
      concurrency: runConcurrency,
    };

    const newAssessment: Assessment = {
      id: generateId(),
      name: name.trim() || `${selectedTarget.name} Assessment`,
      description: description.trim(),
      targetId: selectedTarget.id,
      targetName: selectedTarget.name,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: config,
      runIds: [],
    };

    addAssessment(newAssessment);
    toast.success("Assessment saved as draft");
    onClose();
  };

  const handleStartNow = () => {
    if (!selectedTarget) {
      toast.error("Please select a target");
      return;
    }
    if (categories.length === 0) {
      toast.error("Please select at least one attack category");
      return;
    }

    const config: AssessmentConfig = {
      categories,
      payloadSelection: "all",
      includeVariants,
      adaptiveEnabled,
      evolveEnabled,
      concurrency: runConcurrency,
    };

    const newAssessment: Assessment = {
      id: generateId(),
      name: name.trim() || `${selectedTarget.name} Assessment`,
      description: description.trim(),
      targetId: selectedTarget.id,
      targetName: selectedTarget.name,
      status: "ready",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: config,
      runIds: [],
    };

    addAssessment(newAssessment);
    onLaunch(newAssessment.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl border-border bg-card text-foreground rounded-[4px] shadow-2xl">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">New Assessment Wizard</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configure a structured security evaluation workflow
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-[2px]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stepper */}
          <div className="mt-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-[2px] font-mono text-[11px] font-medium ${
                  step === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                1
              </div>
              <span className={`text-xs font-mono uppercase tracking-wider ${step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                Target
              </span>
            </div>

            <Separator className="w-12 bg-border" />

            <div className="flex items-center gap-2">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-[2px] font-mono text-[11px] font-medium ${
                  step === 2
                    ? "bg-primary text-primary-foreground"
                    : step > 2
                      ? "bg-muted text-foreground border border-border-strong"
                      : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                2
              </div>
              <span className={`text-xs font-mono uppercase tracking-wider ${step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                Configuration
              </span>
            </div>

            <Separator className="w-12 bg-border" />

            <div className="flex items-center gap-2">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-[2px] font-mono text-[11px] font-medium ${
                  step === 3
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                3
              </div>
              <span className={`text-xs font-mono uppercase tracking-wider ${step === 3 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                Review & Launch
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* STEP 1: TARGET SELECTION */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Select Evaluation Target</Label>
                <p className="text-xs text-muted-foreground/80 mb-3">
                  Choose the LLM endpoint that will be subjected to the assessment plan.
                </p>

                {targets.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <Target className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium text-foreground">No targets configured yet</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Configure a target in the Targets configuration view before creating an assessment.
                    </p>
                    <Button size="sm" onClick={onClose} variant="outline">
                      Go to Target Config
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {targets.map((target) => {
                      const isSelected = selectedTargetId === target.id;
                      return (
                        <div
                          key={target.id}
                          onClick={() => {
                            setSelectedTargetId(target.id);
                            setName(`${target.name} - Security Assessment`);
                          }}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-3.5 transition-all ${
                            isSelected
                              ? "border-aegis bg-aegis/10 ring-1 ring-aegis"
                              : "border-border bg-background/50 hover:border-border/80"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                target.connected ? "bg-emerald-400" : "bg-muted-foreground"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">{target.name}</p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {target.model} &middot; {target.provider}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: TEST SCOPE CONFIGURATION */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label htmlFor="assessment-name" className="text-xs">Assessment Name</Label>
                  <Input
                    id="assessment-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q3 LLM Security Assessment"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="assessment-desc" className="text-xs">Description / Objectives (Optional)</Label>
                  <Input
                    id="assessment-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Baseline safety audit against prompt injections and system leaks"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Attack Categories ({categories.length}/{ALL_CATEGORIES.length})
                  </Label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllCategories}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-[11px] text-muted-foreground">&middot;</span>
                    <button
                      onClick={deselectAllCategories}
                      className="text-[11px] text-muted-foreground hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ALL_CATEGORIES.map((cat) => {
                    const count = allPayloads.filter((p) => p.category === cat).length;
                    const isChecked = categories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className={`flex cursor-pointer items-center justify-between rounded-[3px] border p-2.5 transition-colors ${
                          isChecked
                            ? "border-border-strong bg-muted text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleCategory(cat)}
                            className="border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground rounded-[2px]"
                          />
                          <span className="text-xs font-medium">{CATEGORY_LABELS[cat]}</span>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Modules */}
              <div className="rounded-[3px] border border-border bg-card p-3 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Advanced Testing Modules
                </span>
                <div className="space-y-2">
                  <label className="flex items-center justify-between text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={includeVariants}
                        onCheckedChange={(c) => setIncludeVariants(!!c)}
                        className="border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground rounded-[2px]"
                      />
                      <span>Generate Multi-Variant Payloads (Obfuscation, Leetspeak, ROT13)</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-border bg-muted text-muted-foreground font-mono rounded-[2px]">
                      +{totalVariantTypes}x Probes
                    </Badge>
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={adaptiveEnabled}
                        onCheckedChange={(c) => setAdaptiveEnabled(!!c)}
                        className="border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground rounded-[2px]"
                      />
                      <div className="flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Adaptive Feedback Loop (Dynamic prompt mutation on refusals)</span>
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={evolveEnabled}
                        onCheckedChange={(c) => setEvolveEnabled(!!c)}
                        className="border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground rounded-[2px]"
                      />
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Evolutionary Mutation Engine (Genetic payload optimization)</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & ESTIMATION */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-[3px] border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs text-muted-foreground font-mono">Target Endpoint</span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {selectedTarget?.name} ({selectedTarget?.model})
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs text-muted-foreground font-mono">Selected Categories</span>
                  <span className="text-xs text-foreground font-medium">
                    {categories.length} categories ({categories.map((c) => CATEGORY_LABELS[c]).join(", ")})
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs text-muted-foreground font-mono">Variants & Mutators</span>
                  <span className="text-xs text-foreground">
                    {includeVariants ? "Enabled (Base + Variants)" : "Base Payloads Only"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Total Estimated Probes</span>
                  <Badge variant="outline" className="font-mono text-xs border-border-strong bg-muted text-foreground px-2 py-0.5 rounded-[2px]">
                    {estimatedTestCount} Test Probes
                  </Badge>
                </div>
              </div>

              <div className="rounded-[3px] border border-border bg-muted/40 p-3 text-xs text-muted-foreground font-mono">
                You can save this assessment as a Draft to execute later, or Launch to immediately begin streamed adversarial testing.
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            {step > 1 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="gap-1.5 text-xs border-border bg-card text-foreground hover:bg-muted rounded-[3px] h-8"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground rounded-[3px] h-8">
                Cancel
              </Button>
            )}

            <div className="flex items-center gap-2">
              {step === 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  className="gap-1.5 text-xs border-border bg-card text-foreground hover:bg-muted rounded-[3px] h-8"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Draft
                </Button>
              )}

              {step < 3 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    if (step === 1 && !selectedTargetId) {
                      toast.error("Please select a target");
                      return;
                    }
                    if (step === 2 && categories.length === 0) {
                      toast.error("Please select at least one attack category");
                      return;
                    }
                    setStep((s) => (s + 1) as 2 | 3);
                  }}
                  className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] font-medium rounded-[3px] h-8 shadow-none"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartNow}
                  className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] font-medium rounded-[3px] h-8 shadow-none"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Launch Assessment
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
