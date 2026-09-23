"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import type { FindingSeverity, FindingStatus } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
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
  Search,
  CheckCircle2,
  Trash2,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export function FindingsView() {
  const { findings, updateFinding, deleteFinding, assessments, targets, setView } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  // High-level KPI metrics
  const stats = useMemo(() => {
    return {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      open: findings.filter((f) => f.status === "open").length,
      resolved: findings.filter((f) => f.status === "resolved").length,
    };
  }, [findings]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (severityFilter !== "all" && f.severity !== severityFilter) return false;
      if (statusFilter !== "all" && f.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.remediation.toLowerCase().includes(q) ||
          f.affectedTests.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [findings, severityFilter, statusFilter, searchQuery]);

  const getSeverityBadge = (sev: FindingSeverity) => {
    switch (sev) {
      case "critical":
        return (
          <Badge className="bg-red-500/20 text-red-400 border border-red-500/40 uppercase font-mono text-[10px] px-2 py-0.5">
            CRITICAL
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase font-mono text-[10px] px-2 py-0.5">
            HIGH
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase font-mono text-[10px] px-2 py-0.5">
            MEDIUM
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase font-mono text-[10px] px-2 py-0.5">
            LOW
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: FindingStatus) => {
    switch (status) {
      case "resolved":
        return (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
            Resolved
          </Badge>
        );
      case "reviewed":
        return (
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-300 text-[10px]">
            Reviewed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]">
            Open
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">
              FINDINGS <span className="text-aegis">REGISTER</span>
            </h1>
            <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-xs">
              {findings.length} Vulnerabilities
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Confirmed vulnerabilities and adversarial exploits derived from assessment runs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("assessments")}
            className="gap-2 border-border hover:bg-card text-xs"
          >
            <Shield className="h-3.5 w-3.5 text-purple-400" />
            Assessments
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("reports")}
            className="gap-2 border-border hover:bg-card text-xs text-purple-300"
          >
            Generate Report
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Findings</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-foreground">
              {stats.total}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Critical Severity</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-red-400">
              {stats.critical}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">High Severity</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-amber-400">
              {stats.high}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Medium Severity</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-purple-300">
              {stats.medium}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Open / Unresolved</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-amber-300">
              {stats.open}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity filter */}
          <div className="flex items-center rounded-md border border-border/60 bg-background/50 p-0.5 text-xs">
            {["all", "critical", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`rounded px-2.5 py-1 capitalize transition-colors ${
                  severityFilter === sev
                    ? "bg-purple-500/20 text-purple-300 font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center rounded-md border border-border/60 bg-background/50 p-0.5 text-xs">
            {["all", "open", "reviewed", "resolved"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded px-2.5 py-1 capitalize transition-colors ${
                  statusFilter === st
                    ? "bg-purple-500/20 text-purple-300 font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search findings, evidence, tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aegis"
          />
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-12 text-center space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
            <p className="text-sm font-semibold text-foreground">
              {findings.length === 0
                ? "No vulnerability findings recorded yet"
                : "No findings match the active filters"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Execute an assessment run against an LLM target to automatically discover and register security vulnerabilities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedFindingId === finding.id;
            const parentAssessment = assessments.find((a) => a.id === finding.assessmentId);
            const parentTarget = targets.find((t) => t.id === finding.targetId);

            return (
              <Card
                key={finding.id}
                className="border-border bg-card hover:border-border/80 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          {getSeverityBadge(finding.severity)}
                          <h3 className="text-sm font-semibold text-foreground">
                            {finding.title}
                          </h3>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                            {CATEGORY_LABELS[finding.category]}
                          </Badge>
                          {getStatusBadge(finding.status)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                          {parentTarget && (
                            <span>
                              Target: <strong className="text-foreground">{parentTarget.name}</strong>
                            </span>
                          )}
                          {parentAssessment && (
                            <>
                              <span>&middot;</span>
                              <span>
                                Assessment: <strong className="text-foreground">{parentAssessment.name}</strong>
                              </span>
                            </>
                          )}
                          <span>&middot;</span>
                          <span>Confidence: {(finding.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Status switcher */}
                        {finding.status !== "resolved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateFinding(finding.id, { status: "resolved" });
                              toast.success("Finding marked as resolved");
                            }}
                            className="h-7 text-xs px-2 gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            title="Mark as resolved"
                          >
                            <Check className="h-3 w-3" />
                            Resolve
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateFinding(finding.id, { status: "open" });
                              toast.info("Finding reopened");
                            }}
                            className="h-7 text-xs px-2 text-muted-foreground"
                            title="Reopen finding"
                          >
                            Reopen
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedFindingId(isExpanded ? null : finding.id)
                          }
                          className="h-7 px-2 text-xs text-purple-300 hover:text-purple-200"
                        >
                          {isExpanded ? "Collapse" : "Details"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            deleteFinding(finding.id);
                            toast.info("Finding removed");
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                          title="Delete finding"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {finding.description}
                    </p>

                    {/* Expandable Details Drawer */}
                    {isExpanded && (
                      <div className="mt-2 space-y-4 rounded-lg border border-border/60 bg-background/50 p-4 text-xs">
                        {/* Evidence Section */}
                        {finding.evidence.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-2">
                              Empirical Model Evidence
                            </h4>
                            <div className="space-y-1.5">
                              {finding.evidence.map((ev, idx) => (
                                <div
                                  key={idx}
                                  className="rounded border border-border/50 bg-background/80 p-2.5 font-mono text-[11px] text-purple-300 leading-relaxed"
                                >
                                  &ldquo;{ev}&rdquo;
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Affected Probes */}
                        {finding.affectedTests.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1.5">
                              Triggering Attack Probes ({finding.affectedTests.length})
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {finding.affectedTests.map((testName, idx) => (
                                <Badge
                                  key={idx}
                                  variant="secondary"
                                  className="font-mono text-[10px] text-muted-foreground"
                                >
                                  {testName}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <Separator className="my-2" />

                        {/* Remediation Guidance */}
                        <div>
                          <h4 className="font-semibold text-foreground uppercase tracking-wider text-[11px] mb-1">
                            Actionable Defensive Remediation
                          </h4>
                          <p className="text-muted-foreground leading-relaxed text-xs bg-purple-950/20 border border-purple-500/20 rounded p-2.5 text-purple-200">
                            {finding.remediation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
