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
          <Badge className="bg-destructive/15 text-destructive border border-destructive/40 uppercase font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
            CRITICAL
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-warning/15 text-warning border border-warning/40 uppercase font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
            HIGH
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/40 uppercase font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
            MEDIUM
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/40 uppercase font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
            LOW
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: FindingStatus) => {
    switch (status) {
      case "resolved":
        return (
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success text-[10px] font-mono rounded-[2px]">
            Resolved
          </Badge>
        );
      case "reviewed":
        return (
          <Badge variant="outline" className="border-muted-foreground/40 bg-muted-foreground/10 text-muted-foreground text-[10px] font-mono rounded-[2px]">
            Reviewed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning text-[10px] font-mono rounded-[2px]">
            Open
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 space-y-5 p-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-mono tracking-tight text-foreground uppercase">
              Findings Register
            </h1>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
              {findings.length} Vulnerabilities
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            Confirmed vulnerabilities and adversarial exploits derived from assessment runs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("assessments")}
            className="gap-1.5 border-border bg-card hover:bg-muted text-foreground text-xs rounded-[3px] h-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            Assessments
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("reports")}
            className="gap-1.5 border-border bg-card hover:bg-muted text-foreground text-xs rounded-[3px] h-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            Generate Report
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Total Findings</span>
          <div className="text-xl font-bold font-mono text-foreground">
            {stats.total}
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Critical Severity</span>
          <div className="text-xl font-bold font-mono text-destructive">
            {stats.critical}
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">High Severity</span>
          <div className="text-xl font-bold font-mono text-warning">
            {stats.high}
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Medium Severity</span>
          <div className="text-xl font-bold font-mono text-muted-foreground">
            {stats.medium}
          </div>
        </div>

        <div className="rounded-[4px] border border-border bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">Open / Unresolved</span>
          <div className="text-xl font-bold font-mono text-warning">
            {stats.open}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity filter */}
          <div className="flex items-center rounded-[3px] border border-border bg-card p-0.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            {["all", "critical", "high", "medium", "low"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`rounded-[2px] px-2 py-1 capitalize font-mono text-[11px] transition-colors ${
                  severityFilter === sev
                    ? "bg-muted text-foreground border border-border font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center rounded-[3px] border border-border bg-card p-0.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
            {["all", "open", "reviewed", "resolved"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-[2px] px-2 py-1 capitalize font-mono text-[11px] transition-colors ${
                  statusFilter === st
                    ? "bg-muted text-foreground border border-border font-medium"
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
            className="h-8 w-full rounded-[3px] border border-input bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="rounded-[4px] border border-border bg-card p-10 text-center space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <CheckCircle2 className="mx-auto h-6 w-6 text-success" />
          <p className="text-xs font-mono uppercase tracking-wider text-foreground font-semibold">
            {findings.length === 0
              ? "No vulnerability findings recorded"
              : "No findings match active filters"}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto font-sans">
            Execute an assessment run against an LLM target to automatically discover and register security vulnerabilities.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedFindingId === finding.id;
            const parentAssessment = assessments.find((a) => a.id === finding.assessmentId);
            const parentTarget = targets.find((t) => t.id === finding.targetId);

            return (
              <div
                key={finding.id}
                className="rounded-[4px] border border-border bg-card p-3.5 hover:border-border-strong transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
              >
                <div className="flex flex-col gap-2.5">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getSeverityBadge(finding.severity)}
                        <h3 className="text-xs font-semibold text-foreground">
                          {finding.title}
                        </h3>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono border-border bg-muted text-muted-foreground rounded-[2px]">
                          {CATEGORY_LABELS[finding.category]}
                        </Badge>
                        {getStatusBadge(finding.status)}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground pt-0.5">
                        {parentTarget && (
                          <span>
                            Target: <strong className="text-foreground font-normal">{parentTarget.name}</strong>
                          </span>
                        )}
                        {parentAssessment && (
                          <>
                            <span>&middot;</span>
                            <span>
                              Assessment: <strong className="text-foreground font-normal">{parentAssessment.name}</strong>
                            </span>
                          </>
                        )}
                        <span>&middot;</span>
                        <span>Confidence: {(finding.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Status switcher */}
                      {finding.status !== "resolved" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updateFinding(finding.id, { status: "resolved" });
                            toast.success("Finding marked as resolved");
                          }}
                          className="h-6 text-[11px] px-2 gap-1 text-success border-success/30 bg-success/10 hover:bg-success/20 rounded-[2px]"
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
                          className="h-6 text-[11px] px-2 text-muted-foreground border-border hover:bg-muted rounded-[2px]"
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
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted rounded-[2px]"
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
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-muted rounded-[2px]"
                        title="Delete finding"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Short Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                    {finding.description}
                  </p>

                  {/* Expandable Details Drawer */}
                  {isExpanded && (
                    <div className="mt-2 space-y-3 rounded-[3px] border border-border bg-muted p-3 text-xs min-w-0 max-w-full overflow-hidden">
                      {/* Evidence Section */}
                      {finding.evidence.length > 0 && (
                        <div className="min-w-0 max-w-full">
                          <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                            Model Evidence Sample
                          </h4>
                          <div className="space-y-1 min-w-0 max-w-full">
                            {finding.evidence.map((ev, idx) => (
                              <div
                                key={idx}
                                className="rounded-[2px] border border-border bg-card p-2.5 font-mono text-[11px] text-foreground leading-relaxed break-words break-all whitespace-pre-wrap max-h-56 overflow-y-auto min-w-0 max-w-full"
                              >
                                {ev}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Affected Probes */}
                      {finding.affectedTests.length > 0 && (
                        <div>
                          <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Triggering Attack Probes ({finding.affectedTests.length})
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {finding.affectedTests.map((testName, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="font-mono text-[10px] border-border bg-card text-muted-foreground rounded-[2px]"
                              >
                                {testName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Separator className="my-1.5 bg-border" />

                      {/* Remediation Guidance */}
                      <div>
                        <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                          Defensive Remediation Strategy
                        </h4>
                        <div className="text-foreground leading-relaxed text-xs bg-card border border-border rounded-[2px] p-2.5">
                          {finding.remediation}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
