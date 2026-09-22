import type { AttackRun, AttackResult, AttackCategory } from "./types";
import { CATEGORY_LABELS } from "./types";

// ---------------------------------------------------------------------------
// JSON export — full structured data
// ---------------------------------------------------------------------------

export interface ExportedRun {
  version: string;
  tool: string;
  exportDate: string;
  run: {
    id: string;
    target: string;
    categories: AttackCategory[];
    startTime: string;
    endTime: string | null;
    status: string;
    summary: {
      totalAttacks: number;
      breached: number;
      blocked: number;
      breachRate: number;
      severityCounts: Record<string, number>;
      classificationCounts: Record<string, number>;
    };
    results: ExportedResult[];
  };
}

interface ExportedResult {
  id: string;
  payloadId: string;
  payloadName: string;
  category: string;
  categoryLabel: string;
  severity: string;
  prompt: string;
  response: string;
  success: boolean;
  durationMs: number;
  timestamp: string;
  analysis: {
    classification: string;
    severityScore: number;
    confidence: number;
    reasoning: string;
    indicators: string[];
    leakedData: string[];
  };
}

function exportResult(r: AttackResult): ExportedResult {
  return {
    id: r.id,
    payloadId: r.payloadId,
    payloadName: r.payloadName,
    category: r.category,
    categoryLabel: CATEGORY_LABELS[r.category] ?? r.category,
    severity: r.severity,
    prompt: r.prompt,
    response: r.response,
    success: r.success,
    durationMs: r.durationMs,
    timestamp: new Date(r.timestamp).toISOString(),
    analysis: {
      classification: r.analysis.classification,
      severityScore: r.analysis.severityScore,
      confidence: r.analysis.confidence,
      reasoning: r.analysis.reasoning,
      indicators: r.analysis.indicators,
      leakedData: r.analysis.leakedData,
    },
  };
}

export function exportRunAsJSON(run: AttackRun): string {
  const successCount = run.results.filter((r) => r.success).length;
  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const classCounts: Record<string, number> = {
    refusal: 0,
    partial_compliance: 0,
    full_jailbreak: 0,
    information_leakage: 0,
    error: 0,
  };

  for (const r of run.results) {
    if (r.success) sevCounts[r.severity] = (sevCounts[r.severity] ?? 0) + 1;
    classCounts[r.analysis.classification] =
      (classCounts[r.analysis.classification] ?? 0) + 1;
  }

  const exported: ExportedRun = {
    version: "1.0.0",
    tool: "Centauri Aegis AI Security Testing & Research",
    exportDate: new Date().toISOString(),
    run: {
      id: run.id,
      target: run.targetName,
      categories: run.categories,
      startTime: new Date(run.startTime).toISOString(),
      endTime: run.endTime ? new Date(run.endTime).toISOString() : null,
      status: run.status,
      summary: {
        totalAttacks: run.results.length,
        breached: successCount,
        blocked: run.results.length - successCount,
        breachRate: run.results.length > 0 ? +(successCount / run.results.length).toFixed(4) : 0,
        severityCounts: sevCounts,
        classificationCounts: classCounts,
      },
      results: run.results.map(exportResult),
    },
  };

  return JSON.stringify(exported, null, 2);
}

// ---------------------------------------------------------------------------
// CSV export — flat table for spreadsheets
// ---------------------------------------------------------------------------

function escapeCSV(value: string): string {
  // If value contains comma, newline, or double-quote, wrap in quotes
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const CSV_HEADERS = [
  "id",
  "payload_id",
  "payload_name",
  "category",
  "severity",
  "success",
  "classification",
  "severity_score",
  "confidence",
  "duration_ms",
  "timestamp",
  "indicators",
  "leaked_data_count",
  "reasoning",
  "prompt",
  "response",
] as const;

export function exportRunAsCSV(run: AttackRun): string {
  const rows: string[] = [CSV_HEADERS.join(",")];

  for (const r of run.results) {
    const row = [
      escapeCSV(r.id),
      escapeCSV(r.payloadId),
      escapeCSV(r.payloadName),
      escapeCSV(r.category),
      escapeCSV(r.severity),
      r.success ? "TRUE" : "FALSE",
      escapeCSV(r.analysis.classification),
      String(r.analysis.severityScore),
      String(r.analysis.confidence),
      String(r.durationMs),
      new Date(r.timestamp).toISOString(),
      escapeCSV(r.analysis.indicators.join("; ")),
      String(r.analysis.leakedData.length),
      escapeCSV(r.analysis.reasoning),
      escapeCSV(r.prompt),
      escapeCSV(r.response),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// SARIF export — Static Analysis Results Interchange Format (v2.1.0)
// Industry standard for security tools, compatible with GitHub Security tab,
// Azure DevOps, VS Code SARIF Viewer, etc.
// ---------------------------------------------------------------------------

interface SARIFLog {
  version: string;
  $schema: string;
  runs: SARIFRun[];
}

interface SARIFRun {
  tool: { driver: SARIFDriver };
  results: SARIFResult[];
  invocations: SARIFInvocation[];
}

interface SARIFDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SARIFRule[];
}

interface SARIFRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: string };
  properties: { tags: string[] };
}

interface SARIFResult {
  ruleId: string;
  level: string;
  message: { text: string };
  properties: Record<string, unknown>;
}

interface SARIFInvocation {
  executionSuccessful: boolean;
  startTimeUtc: string;
  endTimeUtc: string;
}

const SEVERITY_TO_SARIF_LEVEL: Record<string, string> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
};

const CLASSIFICATION_TO_SARIF_LEVEL: Record<string, string> = {
  full_jailbreak: "error",
  information_leakage: "error",
  partial_compliance: "warning",
  refusal: "none",
  error: "none",
};

export function exportRunAsSARIF(run: AttackRun): string {
  // Build unique rules from categories
  const ruleMap = new Map<string, SARIFRule>();
  const categories: AttackCategory[] = [
    "injection", "jailbreak", "extraction", "bypass",
    "tool_abuse", "multi_turn", "encoding",
  ];

  for (const cat of categories) {
    ruleMap.set(cat, {
      id: `centauri-aegis/${cat}`,
      name: CATEGORY_LABELS[cat],
      shortDescription: { text: `${CATEGORY_LABELS[cat]} attack vector` },
      fullDescription: { text: `Tests model resilience against ${CATEGORY_LABELS[cat].toLowerCase()} attack techniques.` },
      defaultConfiguration: { level: "warning" },
      properties: { tags: ["security", "ai-safety", "llm-red-team", cat] },
    });
  }

  const sarifResults: SARIFResult[] = [];

  for (const r of run.results) {
    // Only include findings (not clean refusals or errors)
    if (r.analysis.classification === "refusal" || r.analysis.classification === "error") {
      continue;
    }

    sarifResults.push({
      ruleId: `centauri-aegis/${r.category}`,
      level: CLASSIFICATION_TO_SARIF_LEVEL[r.analysis.classification] ??
        SEVERITY_TO_SARIF_LEVEL[r.severity] ?? "warning",
      message: {
        text: `[${r.payloadName}] ${r.analysis.classification.replace(/_/g, " ")} detected (severity: ${r.analysis.severityScore}/10, confidence: ${(r.analysis.confidence * 100).toFixed(0)}%). ${r.analysis.reasoning}`,
      },
      properties: {
        payloadId: r.payloadId,
        payloadName: r.payloadName,
        severity: r.severity,
        classification: r.analysis.classification,
        severityScore: r.analysis.severityScore,
        confidence: r.analysis.confidence,
        indicators: r.analysis.indicators,
        leakedDataCount: r.analysis.leakedData.length,
        durationMs: r.durationMs,
      },
    });
  }

  const sarif: SARIFLog = {
    version: "2.1.0",
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Centauri Aegis",
            version: "1.0.0",
            informationUri: "https://github.com/rustyorb/pincer",
            rules: [...ruleMap.values()],
          },
        },
        results: sarifResults,
        invocations: [
          {
            executionSuccessful: run.status !== "cancelled",
            startTimeUtc: new Date(run.startTime).toISOString(),
            endTimeUtc: new Date(run.endTime ?? Date.now()).toISOString(),
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getExportFilename(
  targetName: string,
  format: "json" | "csv" | "sarif",
): string {
  const safeName = (targetName ?? "unknown").replace(/\s+/g, "-").toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === "sarif" ? "sarif.json" : format;
  return `centauri-aegis-${safeName}-${date}.${ext}`;
}
