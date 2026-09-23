"use client";

import { useState, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  exportSession,
  downloadSessionFile,
  parseSessionFile,
  clearStorage,
  getStorageSizeBytes,
  formatBytes,
  mergeSession,
  sessionContainsApiKeys,
  type CentauriAegisSession,
} from "@/lib/persistence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Upload,
  Trash2,
  History,
  Database,
  AlertTriangle,
  FileJson,
  HardDrive,
  Clock,
  Target,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export function SessionManager() {
  const { targets, runs, assessments, findings, selectedCategories, activeTargetId, setActiveRun, setView } =
    useStore();

  // Import state
  const [importedSession, setImportedSession] = useState<CentauriAegisSession | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear confirmation
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");

  // Delete run confirmation
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalResults = runs.reduce((sum, r) => sum + r.results.length, 0);
  const successResults = runs.reduce(
    (sum, r) => sum + r.results.filter((res) => res.success).length,
    0
  );
  const storageSize = getStorageSizeBytes();

  const sortedRuns = [...runs].sort((a, b) => b.startTime - a.startTime);
  const oldestRun = sortedRuns.length > 0 ? sortedRuns[sortedRuns.length - 1] : null;
  const newestRun = sortedRuns.length > 0 ? sortedRuns[0] : null;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleExport = () => {
    const session = exportSession({
      targets,
      runs,
      assessments,
      findings,
      selectedCategories,
      activeTargetId,
    });

    if (sessionContainsApiKeys(session)) {
      toast.warning("Exported session contains API keys. Handle the file with care.");
    }

    downloadSessionFile(session);
    toast.success("Session exported successfully");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const { session, errors } = parseSessionFile(reader.result as string);
      if (session) {
        setImportedSession(session);
        setImportErrors([]);
      } else {
        setImportedSession(null);
        setImportErrors(errors);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!importedSession) return;

    if (importMode === "replace") {
      // Replace: clear existing and load from file
      useStore.setState({
        targets: importedSession.targets,
        runs: importedSession.runs,
        assessments: importedSession.assessments || [],
        findings: importedSession.findings || [],
        selectedCategories: importedSession.selectedCategories,
        activeTargetId: importedSession.activeTargetId,
        activeRunId: null,
      });
      toast.success(
        `Replaced with ${importedSession.targets.length} targets, ${importedSession.runs.length} runs, ${(importedSession.assessments || []).length} assessments`
      );
    } else {
      // Merge: add new items, skip duplicates
      const merged = mergeSession({ targets, runs, assessments, findings }, importedSession);
      const newTargets = merged.targets.length - targets.length;
      const newRuns = merged.runs.length - runs.length;
      const newAssessments = merged.assessments.length - assessments.length;
      const newFindings = merged.findings.length - findings.length;
      useStore.setState({
        targets: merged.targets,
        runs: merged.runs,
        assessments: merged.assessments,
        findings: merged.findings,
      });
      toast.success(
        `Merged: ${newTargets} targets, ${newRuns} runs, ${newAssessments} assessments, ${newFindings} findings`
      );
    }

    // Reset import state
    setImportedSession(null);
    setImportErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClearAll = () => {
    if (clearConfirmText !== "DELETE") return;
    clearStorage();
    useStore.setState({
      targets: [],
      runs: [],
      assessments: [],
      findings: [],
      activeTargetId: null,
      activeRunId: null,
      selectedCategories: ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"],
    });
    setClearDialogOpen(false);
    setClearConfirmText("");
    toast.success("All data cleared");
  };

  const handleDeleteRun = (runId: string) => {
    useStore.getState().deleteRun(runId);
    setDeleteRunId(null);
    toast.success("Run deleted");
  };

  const handleViewRun = (runId: string) => {
    setActiveRun(runId);
    setView("results");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Session Manager
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Export, import, and manage your Centauri Aegis session data
        </p>
      </div>

      {/* ─── Overview Stats ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Session Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Targets</p>
              <p className="text-2xl font-bold text-foreground">{targets.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Attack Runs</p>
              <p className="text-2xl font-bold text-foreground">{runs.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total Results</p>
              <p className="text-2xl font-bold text-foreground">{totalResults}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-success">{successResults}</p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              Storage: {formatBytes(storageSize)}
            </span>
            {oldestRun && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Oldest run: {new Date(oldestRun.startTime).toLocaleDateString()}
              </span>
            )}
            {newestRun && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Latest run: {new Date(newestRun.startTime).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Export ─────────────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Export Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download your full session as a JSON file including all targets, runs, and
            results.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            <FileJson className="h-4 w-4 shrink-0" />
            <span>centauri-aegis-session-{new Date().toISOString().slice(0, 10)}.json</span>
          </div>
          <div className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Exported sessions contain API keys. Handle with care.
          </div>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export Session
          </Button>
        </CardContent>
      </Card>

      {/* ─── Import ─────────────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-primary" />
            Import Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-xs file:text-secondary-foreground"
          />

          {importErrors.length > 0 && (
            <div className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-medium text-destructive">Validation errors:</p>
              {importErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive/80">
                  {err}
                </p>
              ))}
            </div>
          )}

          {importedSession && (
            <>
              <div className="rounded-md border border-border bg-background p-3 text-sm">
                <p className="mb-2 font-medium text-foreground">File preview:</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Version: {importedSession.version}</span>
                  <span>
                    Exported:{" "}
                    {new Date(importedSession.exportedAt).toLocaleDateString()}
                  </span>
                  <span>
                    Targets: {importedSession.targets.length}
                  </span>
                  <span>
                    Runs: {importedSession.runs.length}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                    className="accent-primary"
                  />
                  <span className="text-foreground">Merge</span>
                  <span className="text-xs text-muted-foreground">
                    (add new, skip duplicates)
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                    className="accent-primary"
                  />
                  <span className="text-foreground">Replace</span>
                  <span className="text-xs text-muted-foreground">
                    (clear existing data)
                  </span>
                </label>
              </div>

              <Button onClick={handleImport} className="gap-2">
                <Upload className="h-4 w-4" />
                Import{importMode === "replace" ? " (Replace All)" : " (Merge)"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Run History ────────────────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Run History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedRuns.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground italic">
              No attack runs yet
            </p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {sortedRuns.map((run) => {
                  const successes = run.results.filter((r) => r.success).length;
                  return (
                    <div
                      key={run.id}
                      className="group flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/30"
                    >
                      <button
                        onClick={() => handleViewRun(run.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {run.targetName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.startTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle className="h-3 w-3 text-success" />
                            {successes}
                          </span>
                          <span className="text-xs text-muted-foreground">/</span>
                          <span className="text-xs text-muted-foreground">
                            {run.results.length}
                          </span>
                          <Badge
                            variant={
                              run.status === "completed"
                                ? "secondary"
                                : run.status === "running"
                                  ? "default"
                                  : "outline"
                            }
                            className={
                              run.status === "completed"
                                ? "bg-success/20 text-success"
                                : run.status === "running"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground"
                            }
                          >
                            {run.status}
                          </Badge>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteRunId(run.id);
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ─── Danger Zone ────────────────────────────────────────────────── */}
      <Card className="border-destructive/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete all session data including targets, runs, and results.
            This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={() => setClearDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* ─── Clear Confirmation Dialog ──────────────────────────────────── */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Clear All Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all targets, attack runs, and results. This
              action cannot be undone. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="font-mono"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearConfirmText !== "DELETE"}
              onClick={handleClearAll}
            >
              Clear Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Run Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={deleteRunId !== null} onOpenChange={() => setDeleteRunId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Run</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this attack run? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRunId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteRunId && handleDeleteRun(deleteRunId)}
            >
              Delete Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
