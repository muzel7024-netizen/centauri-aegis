"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Assessment, AssessmentStatus } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { AssessmentWizard } from "./assessment-wizard";
import { AssessmentRunner } from "./assessment-runner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Target,
  Plus,
  Play,
  Copy,
  Trash2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Layers,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export function AssessmentWorkspace() {
  const {
    assessments,
    setActiveAssessment,
    deleteAssessment,
    duplicateAssessment,
    activeTargetId,
  } = useStore();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [runningAssessmentId, setRunningAssessmentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const activeAssessment = assessments.find((a) => a.id === runningAssessmentId);

  // If currently running or inspecting an assessment console, show runner
  if (activeAssessment) {
    return (
      <AssessmentRunner
        assessment={activeAssessment}
        onBack={() => setRunningAssessmentId(null)}
        autoStart={activeAssessment.status === "ready"}
      />
    );
  }

  const filteredAssessments = assessments.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.targetName.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (status: AssessmentStatus) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success font-mono text-[10px] rounded-[2px]">
            COMPLETED
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning font-mono text-[10px] animate-pulse rounded-[2px]">
            RUNNING
          </Badge>
        );
      case "ready":
        return (
          <Badge variant="outline" className="border-border bg-muted text-foreground font-mono text-[10px] rounded-[2px]">
            READY
          </Badge>
        );
      case "stopped":
        return (
          <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive font-mono text-[10px] rounded-[2px]">
            STOPPED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-border bg-card text-muted-foreground font-mono text-[10px] rounded-[2px]">
            DRAFT
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 space-y-5 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-mono tracking-tight text-foreground uppercase">
              Assessment Workspace
            </h1>
            <Badge variant="outline" className="border-border-strong bg-muted text-muted-foreground font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
              {assessments.length} Total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            Structured security assessment plans, test plans, real-time runs, and vulnerability findings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="gap-1.5 bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground font-medium text-xs rounded-[3px] h-8 shadow-none"
          >
            <Plus className="h-3.5 w-3.5" />
            New Assessment
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-[3px] border border-border bg-card p-0.5">
          {["all", "draft", "ready", "running", "completed", "stopped"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-[2px] px-2 py-1 text-xs font-mono capitalize transition-colors ${
                statusFilter === st ? "bg-muted text-foreground border border-border-strong font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-[3px] border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-border-strong focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Assessment Cards List */}
      {filteredAssessments.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-12 text-center space-y-3">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">
              {assessments.length === 0
                ? "No security assessments created yet"
                : "No assessments match the selected filter"}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Assessments bundle evaluation targets, attack categories, advanced mutation modules, and findings into a coherent audit workflow.
            </p>
            {assessments.length === 0 && (
              <Button
                size="sm"
                onClick={() => setWizardOpen(true)}
                className="mt-2 bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground gap-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Create First Assessment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAssessments.map((assessment) => {
            const hasSummary = !!assessment.summary;
            return (
              <div
                key={assessment.id}
                className="rounded-[4px] border border-border bg-card p-4 hover:border-border-strong transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-foreground truncate">
                        {assessment.name}
                      </h3>
                      {getStatusBadge(assessment.status)}
                    </div>

                    {assessment.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 font-sans">
                        {assessment.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        Target: <strong className="text-foreground font-normal">{assessment.targetName}</strong>
                      </span>

                      <span>&middot;</span>

                      <span>
                        {assessment.configuration.categories.length} Categories (
                        {assessment.configuration.categories
                          .map((c) => CATEGORY_LABELS[c])
                          .slice(0, 3)
                          .join(", ")}
                        {assessment.configuration.categories.length > 3 && "..."})
                      </span>

                      {assessment.configuration.includeVariants && (
                        <>
                          <span>&middot;</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-border bg-muted text-muted-foreground rounded-[2px] font-mono">
                            Variants
                          </Badge>
                        </>
                      )}

                      {assessment.configuration.adaptiveEnabled && (
                        <>
                          <span>&middot;</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-border bg-muted text-muted-foreground rounded-[2px] font-mono">
                            Adaptive
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Summary metrics if completed */}
                  {hasSummary && assessment.summary && (
                    <div className="flex items-center gap-4 border-l border-border pl-4 shrink-0">
                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Grade</div>
                        <Badge
                          className={`font-mono text-xs px-2 py-0.5 mt-0.5 rounded-[2px] ${
                            assessment.summary.scoreGrade === "A+" || assessment.summary.scoreGrade === "A"
                              ? "bg-success/15 text-success border border-success/40"
                              : assessment.summary.scoreGrade === "B"
                                ? "bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/40"
                                : "bg-destructive/15 text-destructive border border-destructive/40"
                          }`}
                        >
                          {assessment.summary.scoreGrade}
                        </Badge>
                      </div>

                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Breach Rate</div>
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {assessment.summary.breachRate}%
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Findings</div>
                        <div className="font-mono text-xs font-semibold text-destructive">
                          {assessment.summary.findingsCount.critical +
                            assessment.summary.findingsCount.high +
                            assessment.summary.findingsCount.medium +
                            assessment.summary.findingsCount.low}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Controls */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-2 md:pt-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setActiveAssessment(assessment.id);
                        setRunningAssessmentId(assessment.id);
                      }}
                      className="gap-1.5 bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground text-xs font-medium rounded-[3px] h-7 shadow-none"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      {assessment.status === "completed"
                        ? "Inspect / Rerun"
                        : assessment.status === "running"
                          ? "Console"
                          : assessment.status === "ready"
                            ? "Run"
                            : "Console"}
                    </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateAssessment(assessment.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Duplicate assessment"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAssessment(assessment.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                        title="Delete assessment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard Modal */}
      {wizardOpen && (
        <AssessmentWizard
          onClose={() => setWizardOpen(false)}
          onLaunch={(newId) => {
            setWizardOpen(false);
            setRunningAssessmentId(newId);
          }}
          initialTargetId={activeTargetId}
        />
      )}
    </div>
  );
}
