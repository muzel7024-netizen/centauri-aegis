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
    activeAssessmentId,
    setActiveAssessment,
    deleteAssessment,
    duplicateAssessment,
    targets,
    activeTargetId,
    setView,
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
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-[10px]">
            COMPLETED
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono text-[10px] animate-pulse">
            RUNNING
          </Badge>
        );
      case "ready":
        return (
          <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-300 font-mono text-[10px]">
            READY
          </Badge>
        );
      case "stopped":
        return (
          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 font-mono text-[10px]">
            STOPPED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground font-mono text-[10px]">
            DRAFT
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
              ASSESSMENT <span className="text-aegis">WORKSPACE</span>
            </h1>
            <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-xs">
              {assessments.length} Total
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Structured security assessment plans, test plans, real-time runs, and vulnerability findings
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="gap-2 bg-aegis hover:bg-aegis/90 text-white text-xs shadow-md shadow-purple-950/40"
          >
            <Plus className="h-3.5 w-3.5" />
            New Assessment
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {["all", "draft", "ready", "running", "completed", "stopped"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className={`h-7 text-xs capitalize ${
                statusFilter === st ? "bg-purple-500/15 text-purple-300 font-medium" : "text-muted-foreground"
              }`}
            >
              {st}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assessments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aegis"
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
                className="mt-2 bg-aegis hover:bg-aegis/90 text-white gap-2 text-xs"
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
              <Card
                key={assessment.id}
                className="border-border bg-card hover:border-border/80 transition-colors"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {assessment.name}
                        </h3>
                        {getStatusBadge(assessment.status)}
                      </div>

                      {assessment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {assessment.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-purple-400" />
                          Target: <strong className="text-foreground">{assessment.targetName}</strong>
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
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-500/30 text-purple-300">
                              Variants
                            </Badge>
                          </>
                        )}

                        {assessment.configuration.adaptiveEnabled && (
                          <>
                            <span>&middot;</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-500/30 text-purple-300">
                              Adaptive
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Summary metrics if completed */}
                    {hasSummary && assessment.summary && (
                      <div className="flex items-center gap-4 border-l border-border/40 pl-4 shrink-0">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Grade</div>
                          <Badge
                            className={`font-mono text-xs px-2 py-0.5 mt-0.5 ${
                              assessment.summary.scoreGrade === "A+" || assessment.summary.scoreGrade === "A"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : assessment.summary.scoreGrade === "B"
                                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  : "bg-red-500/20 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {assessment.summary.scoreGrade}
                          </Badge>
                        </div>

                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Breach Rate</div>
                          <div className="font-mono text-sm font-semibold text-foreground">
                            {assessment.summary.breachRate}%
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">Findings</div>
                          <div className="font-mono text-sm font-semibold text-red-400">
                            {assessment.summary.findingsCount.critical +
                              assessment.summary.findingsCount.high +
                              assessment.summary.findingsCount.medium +
                              assessment.summary.findingsCount.low}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                      <Button
                        size="sm"
                        onClick={() => setRunningAssessmentId(assessment.id)}
                        className="gap-1.5 bg-aegis hover:bg-aegis/90 text-white text-xs"
                      >
                        <Play className="h-3 w-3" />
                        {assessment.status === "completed" ? "Inspect / Rerun" : "Console"}
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
                </CardContent>
              </Card>
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
