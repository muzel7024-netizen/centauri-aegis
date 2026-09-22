"use client";

import { CentauriAegisLogo } from "@/components/ui/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Code2,
  Terminal,
  FileCheck2,
  Cpu,
  Layers,
  Sparkles,
  GitBranch,
  AlertTriangle,
  Globe,
  CheckCircle2,
} from "lucide-react";

export function AboutView() {
  return (
    <div className="flex-1 space-y-6 p-8 max-w-5xl">
      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-border/60 pb-8">
        <CentauriAegisLogo size={64} className="drop-shadow-[0_0_25px_rgba(157,78,221,0.35)] shrink-0" />
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              CENTAURI <span className="text-aegis">AEGIS</span>
            </h1>
            <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-mono text-xs">
              v1.0.0
            </Badge>
            <Badge variant="outline" className="border-border bg-card/60 text-muted-foreground font-mono text-xs">
              RELEASE
            </Badge>
          </div>
          <p className="text-base font-medium text-foreground">
            AI Security Testing & Research
          </p>
          <p className="text-xs text-muted-foreground max-w-xl">
            Adversarial red-teaming, jailbreak resistance evaluation, and automated safety auditing platform for modern Large Language Models and AI systems.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Metadata */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-base font-semibold">Project Metadata</CardTitle>
            </div>
            <CardDescription className="text-xs">
              System identity and lead maintainer specifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs">
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-sans">Project Name</span>
              <span className="font-semibold text-foreground">Centauri Aegis</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-sans">Tagline</span>
              <span className="text-purple-300">AI Security Testing & Research</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-sans">Developer</span>
              <span className="text-purple-400 font-semibold">rudrakshp20-hue (@NeelaBillota)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground font-sans">Software License</span>
              <span className="text-foreground">MIT License</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground font-sans">Architecture</span>
              <span className="text-muted-foreground">Next.js 16 App Router • React 19 • Tailwind CSS</span>
            </div>
          </CardContent>
        </Card>

        {/* Upstream Heritage */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-base font-semibold">Upstream Attribution</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Acknowledging open source foundations and upstream linage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              Centauri Aegis was developed from the open-source foundation of the <strong>Pincer / RedPincer</strong> project originally authored by <strong>rustyorb</strong>.
            </p>
            <p>
              In full compliance with the MIT License, original copyright notices and third-party dependency attributions are maintained in the repository under <code className="text-purple-300 font-mono">LICENSE</code> and <code className="text-purple-300 font-mono">THIRD_PARTY_NOTICES.md</code>.
            </p>
            <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-3 flex items-center gap-2.5 text-foreground mt-2">
              <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
              <span>Full original test suite, MIT compliance, and architectural integrity preserved.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engine Capabilities */}
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-base font-semibold">Core Engine Capabilities</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Comprehensive testing modules, heuristic scoring, and adversarial generators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-1">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-purple-400" />
                221 Adversarial Payloads
              </span>
              <p className="text-[11px] text-muted-foreground">
                Spans 7 OWASP LLM top 10 categories including direct injections, jailbreaks, and leaks.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-1">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-purple-400" />
                Multilingual Heuristics
              </span>
              <p className="text-[11px] text-muted-foreground">
                11-language refusal and leakage classification engine operating at zero external LLM overhead.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-1">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                Genetic Evolve Engine
              </span>
              <p className="text-[11px] text-muted-foreground">
                Fitness-directed iterative prompt mutation with ancestor lineage graphs and branch metrics.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-1">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                Multi-Turn Attack Chains
              </span>
              <p className="text-[11px] text-muted-foreground">
                Sequential adversarial scenario pipelines featuring step transforms and dynamic variable slots.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-1">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-purple-400" />
                SARIF 2.1.0 & Compliance
              </span>
              <p className="text-[11px] text-muted-foreground">
                Export standard security findings for GitHub Advanced Security and enterprise SIEM ingest.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/50 p-3.5 space-y-1">
              <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-purple-400" />
                Air-Gapped & Provider Agnostic
              </span>
              <p className="text-[11px] text-muted-foreground">
                Native integrations for OpenAI, Anthropic Claude, Ollama, vLLM, and arbitrary custom gateways.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ethical Research & Security Disclaimer */}
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <CardTitle className="text-base font-semibold">Security & Research Disclaimer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            Centauri Aegis is strictly designed for authorized adversarial testing, defensive engineering, model safety evaluation, and academic security research.
          </p>
          <p>
            Users are solely responsible for ensuring compliance with applicable laws, terms of service, and explicit authorization policies prior to assessing any target LLM systems or network endpoints.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
