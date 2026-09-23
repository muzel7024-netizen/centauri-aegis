"use client";

import { useStore } from "@/lib/store";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { Sidebar } from "@/components/sidebar";
import { TargetConfig } from "@/components/target-config";
import { AttackModules } from "@/components/attack-modules";
import { ResultsDashboard } from "@/components/results-dashboard";
import { ReportGenerator } from "@/components/report-generator";
import { ChainBuilder } from "@/components/chain-builder";
import { SessionManager } from "@/components/session-manager";
import { PayloadEditor } from "@/components/payload-editor";
import { ComparisonDashboard } from "@/components/comparison-dashboard";
import { AdaptiveRunner } from "@/components/adaptive-runner";
import { EvolveRunner } from "@/components/evolve-runner";
import { VulnerabilityHeatmap } from "@/components/vulnerability-heatmap";
import { RegressionRunner } from "@/components/regression-runner";
import { ScoringConfig } from "@/components/scoring-config";
import { DashboardOverview } from "@/components/dashboard-overview";
import { SettingsView } from "@/components/settings-view";
import { AboutView } from "@/components/about-view";
import { AssessmentWorkspace } from "@/components/assessment-workspace";
import { FindingsView } from "@/components/findings-view";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";

export default function Home() {
  const view = useStore((s) => s.view);
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {view === "dashboard" && <DashboardOverview />}
        {view === "config" && <TargetConfig />}
        {view === "assessments" && <AssessmentWorkspace />}
        {view === "findings" && <FindingsView />}
        {view === "attacks" && <AttackModules />}
        {view === "results" && <ResultsDashboard />}
        {view === "reports" && <ReportGenerator />}
        {view === "chains" && <ChainBuilder />}
        {view === "session" && <SessionManager />}
        {view === "editor" && <PayloadEditor />}
        {view === "comparison" && <ComparisonDashboard />}
        {view === "adaptive" && <AdaptiveRunner />}
        {view === "evolve" && <EvolveRunner />}
        {view === "heatmap" && <VulnerabilityHeatmap />}
        {view === "regression" && <RegressionRunner />}
        {view === "scoring" && <ScoringConfig />}
        {view === "settings" && <SettingsView />}
        {view === "about" && <AboutView />}
      </main>
      <KeyboardShortcutsDialog open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
