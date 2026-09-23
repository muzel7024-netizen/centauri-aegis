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
    <div className="flex-1 space-y-6 p-8">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <CentauriAegisLogo size={48} className="drop-shadow-[0_0_15px_rgba(157,78,221,0.3)]" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
                CENTAURI <span className="text-aegis">AEGIS</span>
              </h1>
              <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-xs">
                v1.0.0-PRO
              </Badge>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              AI Security Testing & Research Console — Adversarial LLM Assessment Suite
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("config")}
            className="border-border hover:bg-card gap-2 text-xs"
          >
            <Target className="h-3.5 w-3.5 text-purple-400" />
            Manage Targets
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("findings")}
            className="border-border hover:bg-card gap-2 text-xs"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Findings
            {openFindings.length > 0 && (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] px-1 py-0 h-4">
                {openFindings.length}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => setView("assessments")}
            className="bg-aegis hover:bg-aegis/90 text-white gap-2 text-xs shadow-md shadow-purple-950/40"
          >
            <Shield className="h-3.5 w-3.5" />
            Assessments
            {activeAssessmentsCount > 0 && (
              <Badge variant="outline" className="border-white/30 bg-white/20 text-white text-[10px] px-1 py-0 h-4">
                {activeAssessmentsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Primary KPI Deck */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm cursor-pointer hover:border-purple-500/40 transition-colors" onClick={() => setView("config")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Target
            </CardTitle>
            <Target className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate text-foreground">
              {activeTarget ? activeTarget.name : "None Configured"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {activeTarget
                ? `${activeTarget.provider.toUpperCase()} • ${activeTarget.model}`
                : "Select or add a target in Config"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm cursor-pointer hover:border-purple-500/40 transition-colors" onClick={() => setView("assessments")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Assessments
            </CardTitle>
            <Shield className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-foreground flex items-baseline gap-2">
              {assessments.length}
              {activeAssessmentsCount > 0 && (
                <span className="text-xs font-sans text-purple-400 font-normal">
                  ({activeAssessmentsCount} active)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedAssessmentsCount} completed &middot; {totalAttacksExecuted.toLocaleString()} total attacks
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm cursor-pointer hover:border-amber-500/40 transition-colors" onClick={() => setView("findings")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Security Findings
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-amber-400 flex items-baseline gap-2">
              {openFindings.length}
              <span className="text-xs font-sans text-muted-foreground font-normal">
                open
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {criticalFindings > 0 ? (
                <span className="text-rose-400 font-semibold">{criticalFindings} Critical</span>
              ) : (
                <span>0 Critical</span>
              )}
              {" "}&middot; {highFindings} High &middot; {totalBreaches} breaches
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Global Breach Rate
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-purple-400">
              {overallBreachRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aggregated attack success ratio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Target Status Banner */}
      <Card className="border-border/60 bg-card/40">
        <CardContent className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Target Model Environment:</span>
                {activeTarget ? (
                  <Badge variant="outline" className="border-border bg-background font-mono text-xs">
                    {activeTarget.name} ({activeTarget.model})
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs">
                    No Target Active
                  </Badge>
                )}
                {activeTarget?.connected && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Reachable
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
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
                className="text-xs border-border hover:bg-card"
                onClick={() => setView("config")}
              >
                Change Target
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-aegis hover:bg-aegis/90 text-white text-xs"
                onClick={() => setView("config")}
              >
                Configure Target
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Launch Grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-400" />
          Testing & Research Workflows
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            onClick={() => setView("assessments")}
            className="group cursor-pointer border-border/60 bg-card/60 transition-all hover:border-purple-500/40 hover:bg-card/90"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <Shield className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-purple-400" />
              </div>
              <CardTitle className="text-base font-semibold mt-3 flex items-center justify-between">
                <span>Assessments</span>
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
                  Workspace
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                Scoped test plans, execution runners, live telemetry, and automated finding synthesis.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            onClick={() => setView("findings")}
            className="group cursor-pointer border-border/60 bg-card/60 transition-all hover:border-amber-500/40 hover:bg-card/90"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-amber-400" />
              </div>
              <CardTitle className="text-base font-semibold mt-3 flex items-center justify-between">
                <span>Findings Register</span>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                  Register
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                Empirically verified vulnerabilities, response evidence, affected probes, and remediations.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            onClick={() => setView("attacks")}
            className="group cursor-pointer border-border/60 bg-card/60 transition-all hover:border-purple-500/40 hover:bg-card/90"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <Play className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-purple-400" />
              </div>
              <CardTitle className="text-base font-semibold mt-3">
                Attack Modules
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                221 curatorial adversarial payloads across 7 threat categories.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            onClick={() => setView("chains")}
            className="group cursor-pointer border-border/60 bg-card/60 transition-all hover:border-purple-500/40 hover:bg-card/90"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <Link2 className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-purple-400" />
              </div>
              <CardTitle className="text-base font-semibold mt-3">
                Attack Chains
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                Multi-stage conversational attack pipelines and context injection.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            onClick={() => setView("evolve")}
            className="group cursor-pointer border-border/60 bg-card/60 transition-all hover:border-purple-500/40 hover:bg-card/90"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-purple-400" />
              </div>
              <CardTitle className="text-base font-semibold mt-3">
                Evolve Engine
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                Genetic mutation and evolutionary refinement with lineage tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            onClick={() => setView("reports")}
            className="group cursor-pointer border-border/60 bg-card/60 transition-all hover:border-purple-500/40 hover:bg-card/90"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <FileText className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-purple-400" />
              </div>
              <CardTitle className="text-base font-semibold mt-3">
                Executive Reports
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                Export comprehensive SARIF, CSV, and Markdown audit documents.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Recent Runs Table & Status */}
      <Card className="border-border/60 bg-card/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Recent Assessment Runs</CardTitle>
            <CardDescription className="text-xs">
              Historical execution records and vulnerability outcomes
            </CardDescription>
          </div>
          {runs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("results")}
              className="text-xs gap-1 text-purple-400 hover:text-purple-300"
            >
              View Full Results
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No assessment runs recorded</p>
              <p className="text-xs text-muted-foreground/70 max-w-sm mt-1 mb-4">
                Configure your target and trigger an assessment run from the Attack Modules or sidebar.
              </p>
              <Button
                size="sm"
                onClick={() => setView("attacks")}
                className="bg-aegis hover:bg-aegis/90 text-white text-xs"
              >
                Go to Attack Modules
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Target</th>
                    <th className="pb-2 font-medium">Categories</th>
                    <th className="pb-2 font-medium">Attacks</th>
                    <th className="pb-2 font-medium">Breaches</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {recentRuns.map((r) => {
                    const breaches = r.results.filter((res) => res.success).length;
                    const breachRate = r.results.length > 0
                      ? ((breaches / r.results.length) * 100).toFixed(0)
                      : "0";
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 font-sans font-medium text-foreground">
                          {r.targetName}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {r.categories.length} categories
                        </td>
                        <td className="py-2.5">{r.results.length}</td>
                        <td className="py-2.5">
                          <span
                            className={
                              breaches > 0
                                ? "font-semibold text-rose-400"
                                : "text-emerald-400"
                            }
                          >
                            {breaches} ({breachRate}%)
                          </span>
                        </td>
                        <td className="py-2.5">
                          <Badge
                            variant="outline"
                            className={`capitalize text-[10px] ${
                              r.status === "completed"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : r.status === "cancelled"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : "border-purple-500/30 bg-purple-500/10 text-purple-400"
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
                            className="h-7 text-xs text-purple-400 hover:text-purple-300"
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
        </CardContent>
      </Card>
    </div>
  );
}
