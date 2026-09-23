import {
  SESSION_VERSION,
  STORAGE_KEY,
  validateSession,
  exportSession,
  parseSessionFile,
  mergeSession,
  sessionContainsApiKeys,
  sanitizeSessionForExport,
  saveToStorage,
  loadFromStorage,
  clearStorage,
  getStorageSizeBytes,
  formatBytes,
  type CentauriAegisSession,
} from "../persistence";
import type { TargetConfig, AttackRun, AttackCategory } from "../types";

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeTarget(overrides: Partial<TargetConfig> = {}): TargetConfig {
  return {
    id: "target-1",
    name: "Test Target",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4",
    provider: "openai",
    connected: false,
    ...overrides,
  };
}

function makeRun(overrides: Partial<AttackRun> = {}): AttackRun {
  return {
    id: "run-1",
    targetId: "target-1",
    targetName: "Test Target",
    categories: ["injection"],
    results: [],
    startTime: 1700000000000,
    status: "completed",
    ...overrides,
  } as AttackRun;
}

function makeValidSession(overrides: Partial<CentauriAegisSession> = {}): CentauriAegisSession {
  return {
    version: SESSION_VERSION,
    exportedAt: new Date().toISOString(),
    targets: [makeTarget()],
    runs: [makeRun()],
    selectedCategories: ["injection", "jailbreak"],
    activeTargetId: "target-1",
    ...overrides,
  };
}

// ─── validateSession ───────────────────────────────────────────────────────────

describe("validateSession", () => {
  it("accepts a valid session object", () => {
    const result = validateSession(makeValidSession());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null", () => {
    const result = validateSession(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Session data must be an object");
  });

  it("rejects non-object types", () => {
    expect(validateSession("string").valid).toBe(false);
    expect(validateSession(42).valid).toBe(false);
    expect(validateSession(true).valid).toBe(false);
    expect(validateSession(undefined).valid).toBe(false);
  });

  it("reports missing version", () => {
    const data = makeValidSession();
    delete (data as unknown as Record<string, unknown>).version;
    const result = validateSession(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing or invalid 'version' field");
  });

  it("reports non-string version", () => {
    const result = validateSession({ ...makeValidSession(), version: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("reports missing exportedAt", () => {
    const data = makeValidSession();
    delete (data as unknown as Record<string, unknown>).exportedAt;
    const result = validateSession(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing or invalid 'exportedAt' field");
  });

  it("reports invalid date in exportedAt", () => {
    const result = validateSession({ ...makeValidSession(), exportedAt: "not-a-date" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not a valid ISO date"))).toBe(true);
  });

  it("reports non-array targets", () => {
    const result = validateSession({ ...makeValidSession(), targets: "nope" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("'targets' must be an array");
  });

  it("validates target fields", () => {
    const result = validateSession({
      ...makeValidSession(),
      targets: [{ id: 123, name: null, endpoint: "ok", model: "ok" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("targets[0].id must be a string"))).toBe(true);
    expect(result.errors.some((e) => e.includes("targets[0].name must be a string"))).toBe(true);
  });

  it("reports non-object target entries", () => {
    const result = validateSession({
      ...makeValidSession(),
      targets: ["bad", null],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("targets[0] is not an object"))).toBe(true);
    expect(result.errors.some((e) => e.includes("targets[1] is not an object"))).toBe(true);
  });

  it("reports non-array runs", () => {
    const result = validateSession({ ...makeValidSession(), runs: {} });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("'runs' must be an array");
  });

  it("validates run fields", () => {
    const result = validateSession({
      ...makeValidSession(),
      runs: [{ id: 42, targetId: "t", results: [] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("runs[0].id must be a string"))).toBe(true);
  });

  it("reports non-object run entries", () => {
    const result = validateSession({
      ...makeValidSession(),
      runs: [null],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("runs[0] is not an object"))).toBe(true);
  });

  it("reports run missing results array", () => {
    const result = validateSession({
      ...makeValidSession(),
      runs: [{ id: "r", targetId: "t" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("runs[0].results must be an array"))).toBe(true);
  });

  it("reports non-array selectedCategories", () => {
    const result = validateSession({ ...makeValidSession(), selectedCategories: "injection" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("'selectedCategories' must be an array");
  });

  it("reports invalid categories", () => {
    const result = validateSession({
      ...makeValidSession(),
      selectedCategories: ["injection", "fake_category"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid category: fake_category"))).toBe(true);
  });

  it("accepts all valid categories", () => {
    const allCats: AttackCategory[] = [
      "injection", "jailbreak", "extraction", "bypass",
      "tool_abuse", "multi_turn", "encoding",
    ];
    const result = validateSession({ ...makeValidSession(), selectedCategories: allCats });
    expect(result.valid).toBe(true);
  });

  it("accepts empty targets and runs arrays", () => {
    const result = validateSession({
      ...makeValidSession(),
      targets: [],
      runs: [],
      selectedCategories: [],
    });
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors at once", () => {
    const result = validateSession({
      version: 42,
      exportedAt: "bad-date",
      targets: "no",
      runs: null,
      selectedCategories: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── exportSession ─────────────────────────────────────────────────────────────

describe("exportSession", () => {
  it("produces a valid session with current version", () => {
    const state = {
      targets: [makeTarget()],
      runs: [makeRun()],
      selectedCategories: ["injection" as AttackCategory],
      activeTargetId: "target-1",
    };
    const exported = exportSession(state);
    expect(exported.version).toBe(SESSION_VERSION);
    expect(exported.targets).toEqual(state.targets);
    expect(exported.runs).toEqual(state.runs);
    expect(exported.selectedCategories).toEqual(state.selectedCategories);
    expect(exported.activeTargetId).toBe("target-1");
  });

  it("sets exportedAt to a valid ISO date", () => {
    const before = Date.now();
    const exported = exportSession({
      targets: [],
      runs: [],
      selectedCategories: [],
      activeTargetId: null,
    });
    const after = Date.now();
    const exportTime = new Date(exported.exportedAt).getTime();
    expect(exportTime).toBeGreaterThanOrEqual(before);
    expect(exportTime).toBeLessThanOrEqual(after);
  });

  it("exported session passes validation", () => {
    const exported = exportSession({
      targets: [makeTarget()],
      runs: [makeRun()],
      selectedCategories: ["jailbreak"],
      activeTargetId: null,
    });
    expect(validateSession(exported).valid).toBe(true);
  });
});

// ─── parseSessionFile ──────────────────────────────────────────────────────────

describe("parseSessionFile", () => {
  it("parses valid JSON session", () => {
    const session = makeValidSession();
    const json = JSON.stringify(session);
    const result = parseSessionFile(json);
    expect(result.session).not.toBeNull();
    expect(result.errors).toHaveLength(0);
    expect(result.session!.version).toBe(SESSION_VERSION);
  });

  it("rejects invalid JSON", () => {
    const result = parseSessionFile("{ not json }}}");
    expect(result.session).toBeNull();
    expect(result.errors).toContain("Invalid JSON: could not parse file");
  });

  it("rejects valid JSON that fails validation", () => {
    const result = parseSessionFile('{"foo": "bar"}');
    expect(result.session).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects empty string", () => {
    const result = parseSessionFile("");
    expect(result.session).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("round-trips export → parse", () => {
    const original = exportSession({
      targets: [makeTarget(), makeTarget({ id: "t2", name: "Second" })],
      runs: [makeRun()],
      selectedCategories: ["extraction", "bypass"],
      activeTargetId: "t2",
    });
    const json = JSON.stringify(original);
    const parsed = parseSessionFile(json);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.session).toEqual(original);
  });
});

// ─── mergeSession ──────────────────────────────────────────────────────────────

describe("mergeSession", () => {
  it("adds new targets and runs", () => {
    const existing = { targets: [makeTarget()], runs: [makeRun()] };
    const imported = makeValidSession({
      targets: [makeTarget({ id: "target-2", name: "New Target" })],
      runs: [makeRun({ id: "run-2" })],
    });
    const merged = mergeSession(existing, imported);
    expect(merged.targets).toHaveLength(2);
    expect(merged.runs).toHaveLength(2);
  });

  it("skips duplicate targets by id", () => {
    const existing = { targets: [makeTarget()], runs: [] };
    const imported = makeValidSession({
      targets: [makeTarget({ name: "Duplicate Name" })], // same id
    });
    const merged = mergeSession(existing, imported);
    expect(merged.targets).toHaveLength(1);
    expect(merged.targets[0].name).toBe("Test Target"); // keeps original
  });

  it("skips duplicate runs by id", () => {
    const existing = { targets: [], runs: [makeRun()] };
    const imported = makeValidSession({
      runs: [makeRun()], // same id
    });
    const merged = mergeSession(existing, imported);
    expect(merged.runs).toHaveLength(1);
  });

  it("merges from empty existing state", () => {
    const existing = { targets: [], runs: [] };
    const imported = makeValidSession({
      targets: [makeTarget(), makeTarget({ id: "t2" })],
      runs: [makeRun(), makeRun({ id: "r2" })],
    });
    const merged = mergeSession(existing, imported);
    expect(merged.targets).toHaveLength(2);
    expect(merged.runs).toHaveLength(2);
  });

  it("handles import with empty targets/runs", () => {
    const existing = { targets: [makeTarget()], runs: [makeRun()] };
    const imported = makeValidSession({ targets: [], runs: [] });
    const merged = mergeSession(existing, imported);
    expect(merged.targets).toHaveLength(1);
    expect(merged.runs).toHaveLength(1);
  });
});

// ─── sessionContainsApiKeys ────────────────────────────────────────────────────

describe("sessionContainsApiKeys", () => {
  it("returns false when no targets have apiKey", () => {
    const session = makeValidSession({
      targets: [makeTarget()], // no apiKey set
    });
    expect(sessionContainsApiKeys(session)).toBe(false);
  });

  it("returns true when a target has non-empty apiKey", () => {
    const session = makeValidSession({
      targets: [makeTarget({ apiKey: "sk-test-key-123" })],
    });
    expect(sessionContainsApiKeys(session)).toBe(true);
  });

  it("returns false when apiKey is empty string", () => {
    const session = makeValidSession({
      targets: [makeTarget({ apiKey: "" })],
    });
    expect(sessionContainsApiKeys(session)).toBe(false);
  });

  it("returns false with no targets", () => {
    const session = makeValidSession({ targets: [] });
    expect(sessionContainsApiKeys(session)).toBe(false);
  });

  it("returns true if any target has a key", () => {
    const session = makeValidSession({
      targets: [
        makeTarget({ id: "t1" }),
        makeTarget({ id: "t2", apiKey: "sk-key" }),
        makeTarget({ id: "t3" }),
      ],
    });
    expect(sessionContainsApiKeys(session)).toBe(true);
  });
});

// ─── sanitizeSessionForExport ──────────────────────────────────────────────────

describe("sanitizeSessionForExport", () => {
  it("strips apiKey from targets", () => {
    const session = makeValidSession({
      targets: [makeTarget({ apiKey: "sk-secret-key" })],
    });
    const sanitized = sanitizeSessionForExport(session);
    expect(sanitized.targets[0]).not.toHaveProperty("apiKey");
  });

  it("strips apiKeyId from targets", () => {
    const session = makeValidSession({
      targets: [makeTarget({ apiKeyId: "vault-ref-123" })],
    });
    const sanitized = sanitizeSessionForExport(session);
    expect(sanitized.targets[0]).not.toHaveProperty("apiKeyId");
  });

  it("preserves non-sensitive target fields", () => {
    const target = makeTarget({
      apiKey: "sk-secret",
      apiKeyId: "vault-ref",
      apiKeyLabel: "sk-...cret",
    });
    const session = makeValidSession({ targets: [target] });
    const sanitized = sanitizeSessionForExport(session);
    const t = sanitized.targets[0];
    expect(t.id).toBe(target.id);
    expect(t.name).toBe(target.name);
    expect(t.endpoint).toBe(target.endpoint);
    expect(t.model).toBe(target.model);
    expect(t.provider).toBe(target.provider);
    expect(t.apiKeyLabel).toBe("sk-...cret");
  });

  it("preserves other session fields", () => {
    const session = makeValidSession();
    const sanitized = sanitizeSessionForExport(session);
    expect(sanitized.version).toBe(session.version);
    expect(sanitized.exportedAt).toBe(session.exportedAt);
    expect(sanitized.runs).toBe(session.runs);
    expect(sanitized.selectedCategories).toBe(session.selectedCategories);
    expect(sanitized.activeTargetId).toBe(session.activeTargetId);
  });

  it("does not mutate the original session", () => {
    const session = makeValidSession({
      targets: [makeTarget({ apiKey: "sk-original" })],
    });
    sanitizeSessionForExport(session);
    expect(session.targets[0].apiKey).toBe("sk-original");
  });
});

// ─── localStorage helpers ──────────────────────────────────────────────────────

describe("localStorage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("saveToStorage", () => {
    it("saves data to localStorage", () => {
      const data = { foo: "bar", count: 42 };
      const result = saveToStorage("test-key", data);
      expect(result).toBe(true);
      expect(localStorage.getItem("test-key")).toBe(JSON.stringify(data));
    });

    it("returns true on success", () => {
      expect(saveToStorage("k", "v")).toBe(true);
    });
  });

  describe("loadFromStorage", () => {
    it("loads and parses stored data", () => {
      localStorage.setItem("test-key", JSON.stringify({ x: 1 }));
      const result = loadFromStorage<{ x: number }>("test-key");
      expect(result).toEqual({ x: 1 });
    });

    it("returns null for missing key", () => {
      expect(loadFromStorage("nonexistent")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      localStorage.setItem("bad", "not json{{{");
      expect(loadFromStorage("bad")).toBeNull();
    });
  });

  describe("clearStorage", () => {
    it("removes the storage key", () => {
      localStorage.setItem(STORAGE_KEY, "data");
      clearStorage();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("does not throw when key doesn't exist", () => {
      expect(() => clearStorage()).not.toThrow();
    });
  });

  describe("getStorageSizeBytes", () => {
    it("returns 0 when nothing stored", () => {
      expect(getStorageSizeBytes()).toBe(0);
    });

    it("returns byte size of stored data", () => {
      const data = "hello world";
      localStorage.setItem(STORAGE_KEY, data);
      const size = getStorageSizeBytes();
      expect(size).toBe(new Blob([data]).size);
    });
  });
});

// ─── formatBytes ───────────────────────────────────────────────────────────────

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes under 1KB", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2560)).toBe("2.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(1572864)).toBe("1.5 MB");
  });

  it("caps at MB even for large values", () => {
    // 1 GB in bytes — should still use MB since units only go to MB
    const result = formatBytes(1073741824);
    expect(result).toContain("MB");
  });

  it("formats 1 byte", () => {
    expect(formatBytes(1)).toBe("1 B");
  });
});

// ─── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("SESSION_VERSION is a semver string", () => {
    expect(SESSION_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("STORAGE_KEY is the expected value", () => {
    expect(STORAGE_KEY).toBe("centauri-aegis-state");
  });
});
