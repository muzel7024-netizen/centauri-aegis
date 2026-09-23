import type {
  TargetConfig,
  AttackRun,
  AttackCategory,
  Assessment,
  Finding,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const STORAGE_KEY = "centauri-aegis-state";
export const LEGACY_STORAGE_KEY = "redpincer-state"; // Legacy compatibility only — do not use for new deployments.
export const SESSION_VERSION = "1.1.0";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CentauriAegisSession {
  version: string;
  exportedAt: string;
  targets: TargetConfig[];
  runs: AttackRun[];
  selectedCategories: AttackCategory[];
  activeTargetId: string | null;
  assessments?: Assessment[];
  findings?: Finding[];
}

/**
 * @deprecated Legacy compatibility only — do not use for new deployments. Use CentauriAegisSession instead.
 */
export type RedPincerSession = CentauriAegisSession;

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_CATEGORIES: AttackCategory[] = [
  "injection",
  "jailbreak",
  "extraction",
  "bypass",
  "tool_abuse",
  "multi_turn",
  "encoding",
];

export function validateSession(
  data: unknown
): { valid: boolean; errors: string[]; session?: CentauriAegisSession } {
  const errors: string[] = [];

  if (data === null || typeof data !== "object") {
    return { valid: false, errors: ["Session data must be an object"] };
  }

  const obj = data as Record<string, unknown>;

  // Version check
  if (typeof obj.version !== "string") {
    errors.push("Missing or invalid 'version' field");
  }

  // exportedAt check
  if (typeof obj.exportedAt !== "string") {
    errors.push("Missing or invalid 'exportedAt' field");
  } else if (isNaN(Date.parse(obj.exportedAt as string))) {
    errors.push("'exportedAt' is not a valid ISO date string");
  }

  // targets check
  if (!Array.isArray(obj.targets)) {
    errors.push("'targets' must be an array");
  } else {
    for (let i = 0; i < obj.targets.length; i++) {
      const t = obj.targets[i] as Record<string, unknown>;
      if (!t || typeof t !== "object") {
        errors.push(`targets[${i}] is not an object`);
        continue;
      }
      if (typeof t.id !== "string") errors.push(`targets[${i}].id must be a string`);
      if (typeof t.name !== "string") errors.push(`targets[${i}].name must be a string`);
      if (typeof t.endpoint !== "string") errors.push(`targets[${i}].endpoint must be a string`);
      if (typeof t.model !== "string") errors.push(`targets[${i}].model must be a string`);
    }
  }

  // runs check
  if (!Array.isArray(obj.runs)) {
    errors.push("'runs' must be an array");
  } else {
    for (let i = 0; i < obj.runs.length; i++) {
      const r = obj.runs[i] as Record<string, unknown>;
      if (!r || typeof r !== "object") {
        errors.push(`runs[${i}] is not an object`);
        continue;
      }
      if (typeof r.id !== "string") errors.push(`runs[${i}].id must be a string`);
      if (typeof r.targetId !== "string") errors.push(`runs[${i}].targetId must be a string`);
      if (!Array.isArray(r.results)) errors.push(`runs[${i}].results must be an array`);
    }
  }

  // selectedCategories check
  if (!Array.isArray(obj.selectedCategories)) {
    errors.push("'selectedCategories' must be an array");
  } else {
    for (const cat of obj.selectedCategories) {
      if (!VALID_CATEGORIES.includes(cat as AttackCategory)) {
        errors.push(`Invalid category: ${String(cat)}`);
      }
    }
  }

  // assessments check (optional, for backward compatibility)
  if (obj.assessments !== undefined && !Array.isArray(obj.assessments)) {
    errors.push("'assessments' must be an array when present");
  }

  // findings check (optional, for backward compatibility)
  if (obj.findings !== undefined && !Array.isArray(obj.findings)) {
    errors.push("'findings' must be an array when present");
  }

  const session =
    errors.length === 0
      ? ({
          ...obj,
          assessments: Array.isArray(obj.assessments) ? obj.assessments : [],
          findings: Array.isArray(obj.findings) ? obj.findings : [],
        } as unknown as CentauriAegisSession)
      : undefined;

  return { valid: errors.length === 0, errors, session };
}

// ─── Export / Import ──────────────────────────────────────────────────────────

export function exportSession(state: {
  targets: TargetConfig[];
  runs: AttackRun[];
  selectedCategories: AttackCategory[];
  activeTargetId: string | null;
  assessments?: Assessment[];
  findings?: Finding[];
}): CentauriAegisSession {
  return {
    version: SESSION_VERSION,
    exportedAt: new Date().toISOString(),
    targets: state.targets,
    runs: state.runs,
    selectedCategories: state.selectedCategories,
    activeTargetId: state.activeTargetId,
    assessments: state.assessments || [],
    findings: state.findings || [],
  };
}

export function downloadSessionFile(session: CentauriAegisSession): void {
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `centauri-aegis-session-${date}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseSessionFile(
  jsonString: string
): { session: CentauriAegisSession | null; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { session: null, errors: ["Invalid JSON: could not parse file"] };
  }

  const validation = validateSession(parsed);
  if (!validation.valid) {
    return { session: null, errors: validation.errors };
  }

  return { session: parsed as CentauriAegisSession, errors: [] };
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function saveToStorage(key: string, data: unknown): boolean {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    return true;
  } catch (e) {
    // Quota exceeded or serialization error
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.error("localStorage quota exceeded");
    }
    return false;
  }
}

export function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key) ?? (key === STORAGE_KEY ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // silently ignore
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getStorageSizeBytes(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return 0;
    return new Blob([raw]).size;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Merge an imported session into existing state, skipping duplicates by id.
 */
export function mergeSession(
  existing: {
    targets: TargetConfig[];
    runs: AttackRun[];
    assessments?: Assessment[];
    findings?: Finding[];
  },
  imported: CentauriAegisSession
): {
  targets: TargetConfig[];
  runs: AttackRun[];
  assessments: Assessment[];
  findings: Finding[];
} {
  const existingTargetIds = new Set(existing.targets.map((t) => t.id));
  const existingRunIds = new Set(existing.runs.map((r) => r.id));
  const existingAssessmentIds = new Set((existing.assessments || []).map((a) => a.id));
  const existingFindingIds = new Set((existing.findings || []).map((f) => f.id));

  const newTargets = imported.targets.filter((t) => !existingTargetIds.has(t.id));
  const newRuns = imported.runs.filter((r) => !existingRunIds.has(r.id));
  const newAssessments = (imported.assessments || []).filter(
    (a) => !existingAssessmentIds.has(a.id)
  );
  const newFindings = (imported.findings || []).filter(
    (f) => !existingFindingIds.has(f.id)
  );

  return {
    targets: [...existing.targets, ...newTargets],
    runs: [...existing.runs, ...newRuns],
    assessments: [...(existing.assessments || []), ...newAssessments],
    findings: [...(existing.findings || []), ...newFindings],
  };
}

/**
 * Check if session contains API keys (for user warning).
 */
export function sessionContainsApiKeys(session: CentauriAegisSession): boolean {
  return session.targets.some((t) => t.apiKey && t.apiKey.length > 0);
}

/**
 * Strip sensitive data from session for safe export.
 * Removes plaintext apiKey, keeps only apiKeyLabel for reference.
 */
export function sanitizeSessionForExport(session: CentauriAegisSession): CentauriAegisSession {
  return {
    ...session,
    targets: session.targets.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { apiKey: _key, apiKeyId: _id, ...safe } = t;
      return safe as typeof t;
    }),
  };
}
