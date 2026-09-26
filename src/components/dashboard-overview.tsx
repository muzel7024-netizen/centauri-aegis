"use client";

import { useStore } from "@/lib/store";
import { CentauriAegisLogo } from "@/components/ui/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Target,
  BarChart3,
  Link2,
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Play,
  Layers,
  ExternalLink,
} from "lucide-react";

export function DashboardOverview() {
  const {
    targets,
    activeTargetId,
    runs,
    assessments,
    findings,
    setView,
    setActiveRun,
  } = useStore();

  const activeTarget = targets.find((t) => t.id === activeTargetId) ?? targets[0] ?? null;

  // Calculate high-level KPIs across all runs
  const totalAttacksExecuted = runs.reduce((acc, r) => acc + (r.results?.length || 0), 0);
  const totalBreaches = runs.reduce(
    (acc, r) => acc + (r.results?.filter((res) => res.success)?.length || 0),
    0
  );
  const overallBreachRate =
    totalAttacksExecuted > 0
      ? ((totalBreaches / totalAttacksExecuted) * 100).toFixed(1)
      : "0.0";

  // Assessment & Finding KPIs
  const activeAssessmentsCount = assessments.filter((a) => a.status === "running" || a.status === "ready").length;
  const completedAssessmentsCount = assessments.filter((a) => a.status === "completed").length;
  const openFindings = findings.filter((f) => f.status === "open");
  const criticalFindings = openFindings.filter((f) => f.severity === "critical").length;
  const highFindings = openFindings.filter((f) => f.severity === "high").length;

  const recentRuns = [...runs]
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 5);

  return (
    <div className="flex-1 space-y-5 p-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3.5">
          <CentauriAegisLogo size={36} className="shrink-0" />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                CENTAURI AEGIS
              </h1>
              <Badge variant="outline" className="border-border bg-muted text-muted-foreground font-mono text-[10px] px-1.5 py-0.5 rounded-[2px]">
                WORKSTATION v1.0
              </Badge>
              <span className="flex items-center gap-1.5 rounded-[2px] border border-border bg-card px-2 py-0.5 text-[11px] font-mono font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                OPERATIONAL
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              AI Security Testing & Adversarial Research Console
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("config")}
            className="border-border bg-card hover:bg-muted text-foreground gap-1.5 text-xs rounded-[3px] h-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            Manage Targets
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("findings")}
            className="border-border bg-card hover:bg-muted text-foreground gap-1.5 text-xs rounded-[3px] h-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            Findings
            {openFindings.length > 0 && (
              <span className="border border-border bg-muted text-warning font-mono text-[10px] px-1 rounded-[2px]">
                {openFindings.length}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => setView("assessments")}
            className="bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground font-medium gap-1.5 text-xs rounded-[3px] h-8 shadow-none"
          >
            <Shield className="h-3.5 w-3.5" />
            Assessments
            {activeAssessmentsCount > 0 && (
              <span className="border border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground font-mono text-[10px] px-1 rounded-[2px]">
                {activeAssessmentsCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Primary KPI Deck */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card rounded-[4px] p-4 cursor-pointer hover:border-border-strong transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none" onClick={() => setView("config")}>
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Active Target
            </span>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-lg font-semibold truncate text-foreground font-sans">
              {activeTarget ? activeTarget.name : "None Configured"}
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1 truncate">
              {activeTarget
                ? `${activeTarget.provider.toUpperCase()} • ${activeTarget.model}`
                : "Select or add target in Config"}
            </p>
          </div>
        </Card>

        <Card className="border-border bg-card rounded-[4px] p-4 cursor-pointer hover:border-border-strong transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none" onClick={() => setView("assessments")}>
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Assessments
            </span>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-2">
              {assessments.length}
              {activeAssessmentsCount > 0 && (
                <span className="text-xs font-mono text-muted-foreground font-normal">
                  ({activeAssessmentsCount} active)
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {completedAssessmentsCount} completed &middot; {totalAttacksExecuted.toLocaleString()} total attacks
            </p>
          </div>
        </Card>

        <Card className="border-border bg-card rounded-[4px] p-4 cursor-pointer hover:border-border-strong transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none" onClick={() => setView("findings")}>
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Security Findings
            </span>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-2">
              {openFindings.length}
              <span className="text-xs font-sans text-muted-foreground font-normal">
                open
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {criticalFindings > 0 ? (
                <span className="text-destructive font-semibold">{criticalFindings} Critical</span>
              ) : (
                <span>0 Critical</span>
              )}
              {" "}&middot; {highFindings} High &middot; {totalBreaches} breaches
            </p>
          </div>
        </Card>

        <Card className="border-border bg-card rounded-[4px] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Global Breach Rate
            </span>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-lg font-bold font-mono text-foreground">
              {overallBreachRate}%
            </div>
            <p className="text-xs font-sans text-muted-foreground mt-1">
              Aggregated attack success ratio
            </p>
          </div>
        </Card>
      </div>

      {/* Target Status Banner */}
      <div className="rounded-[4px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-border bg-muted text-muted-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground uppercase tracking-wide">Target Environment:</span>
                {activeTarget ? (
                  <Badge variant="outline" className="border-border bg-muted font-mono text-[11px] text-foreground rounded-[2px]">
                    {activeTarget.name} ({activeTarget.model})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-border bg-muted text-warning font-mono text-[11px] rounded-[2px]">
                    No Target Active
                  </Badge>
                )}
                {activeTarget?.connected && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Reachable
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {activeTarget
                  ? `Endpoint: ${activeTarget.endpoint.replace(/(https?:\/\/[^/]+).*/, "$1/...")} • Provider: ${activeTarget.provider}`
                  : "Connect an LLM target via OpenAI, Anthropic, Ollama, or Custom API to begin testing."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {activeTarget ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-border bg-muted hover:bg-accent text-foreground rounded-[3px] h-8"
                onClick={() => setView("config")}
              >
                Change Target
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground text-xs font-medium rounded-[3px] h-8 shadow-none"
                onClick={() => setView("config")}
              >
                Configure Target
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Launch Grid */}
      <div>
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          Testing & Research Workflows
        </h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div
            onClick={() => setView("assessments")}
            className="group cursor-pointer rounded-[4px] border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-muted-foreground">
                <Shield className="h-4 w-4" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Assessments</span>
              <span className="font-mono text-[10px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
                WORKSPACE
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Scoped test plans, execution runners, live telemetry, and automated finding synthesis.
            </p>
          </div>

          <div
            onClick={() => setView("findings")}
            className="group cursor-pointer rounded-[4px] border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Findings Register</span>
              <span className="font-mono text-[10px] text-warning border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
                REGISTER
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Empirically verified vulnerabilities, response evidence, affected probes, and remediations.
            </p>
          </div>

          <div
            onClick={() => setView("attacks")}
            className="group cursor-pointer rounded-[4px] border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-muted-foreground">
                <Play className="h-4 w-4" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Attack Modules</span>
              <span className="font-mono text-[10px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
                PAYLOADS
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Adversarial payloads across prompt injection, jailbreak, bypass, extraction, and encoding.
            </p>
          </div>

          <div
            onClick={() => setView("chains")}
            className="group cursor-pointer rounded-[4px] border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-muted-foreground">
                <Link2 className="h-4 w-4" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Attack Chains</span>
              <span className="font-mono text-[10px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
                PIPELINES
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Multi-stage conversational attack pipelines, contextual state pivots, and escalations.
            </p>
          </div>

          <div
            onClick={() => setView("evolve")}
            className="group cursor-pointer rounded-[4px] border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-muted-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Evolve Engine</span>
              <span className="font-mono text-[10px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
                MUTATION
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Genetic mutation and evolutionary refinement with lineage tracking.
            </p>
          </div>

          <div
            onClick={() => setView("reports")}
            className="group cursor-pointer rounded-[4px] border border-border bg-card p-3.5 transition-colors hover:border-border-strong hover:bg-muted/50 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-border bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Executive Reports</span>
              <span className="font-mono text-[10px] text-muted-foreground border border-border bg-muted px-1.5 py-0.5 rounded-[2px]">
                AUDIT
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              Export comprehensive SARIF, CSV, and Markdown audit documents.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Runs Table & Status */}
      <div className="rounded-[4px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
        <div className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Execution History</span>
            <p className="text-sm font-medium text-foreground">Recent Assessment Runs</p>
          </div>
          {runs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("results")}
              className="text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-[2px] h-7"
            >
              View Full Results
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="pt-3">
          {recentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-xs font-mono text-foreground font-semibold">NO ASSESSMENT RUNS RECORDED</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-3 font-sans">
                Configure your target and trigger an assessment run from Attack Modules or the sidebar.
              </p>
              <Button
                size="sm"
                onClick={() => setView("attacks")}
                className="bg-primary hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] text-primary-foreground text-xs font-medium rounded-[3px] h-8 shadow-none"
              >
                Go to Attack Modules
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left font-mono text-[10px] uppercase">
                    <th className="pb-2 font-medium">Target</th>
                    <th className="pb-2 font-medium">Categories</th>
                    <th className="pb-2 font-medium">Attacks</th>
                    <th className="pb-2 font-medium">Breaches</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {recentRuns.map((r) => {
                    const breaches = r.results.filter((res) => res.success).length;
                    const breachRate = r.results.length > 0
                      ? ((breaches / r.results.length) * 100).toFixed(0)
                      : "0";
                    return (
                      <tr key={r.id} className="hover:bg-muted/50 transition-colors">
                        <td className="py-2.5 font-sans font-medium text-foreground">
                          {r.targetName}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {r.categories.length} categories
                        </td>
                        <td className="py-2.5 text-foreground">{r.results.length}</td>
                        <td className="py-2.5">
                          <span
                            className={
                              breaches > 0
                                ? "font-semibold text-destructive"
                                : "text-success"
                            }
                          >
                            {breaches} ({breachRate}%)
                          </span>
                        </td>
                        <td className="py-2.5">
                          <Badge
                            variant="outline"
                            className={`capitalize text-[10px] rounded-[2px] ${
                              r.status === "completed"
                                ? "border-border bg-muted text-success"
                                : r.status === "cancelled"
                                ? "border-border bg-muted text-warning"
                                : "border-border bg-muted text-primary"
                            }`}
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {new Date(r.startTime).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-[2px] px-2 font-sans"
                            onClick={() => {
                              setActiveRun(r.id);
                              setView("results");
                            }}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
