# Centauri Aegis — Visual & Functional QA Walkthrough

This document records the visual and functional Quality Assurance (QA) pass on **Centauri Aegis** (*AI Security Testing & Research*), created by `rudrakshp20-hue (@NeelaBillota)`.

---

## 1. Objectives & Approach

The objective was to rigorously test the **Centauri Aegis** security console to guarantee:
1. **Visual Excellence**: Professional dark security/research styling with steel-blue accents (`#5B8DB8`), deep graphite canvas (`#08090B`), clean vector shield logo, zero emojis, zero tropes, and sharp contrast across all screens.
2. **Branding Integrity**: Consistent presentation as Centauri Aegis across all components, exports, and documentation.
3. **Functional Robustness**: Complete end-to-end functionality across Attack Modules, Chains, Adaptive Testing, Evolution, Scoring, Heatmap, Key Vault, and SARIF/JSON/CSV exports.
4. **Zero Regressions**: 100% pass across all unit and integration tests, clean TypeScript compilation, and production Turbopack builds.

---

## 2. Platform Architecture & Modules

1. **Evolution Runner Metadata**:
   * *Location*: `src/lib/evolve/runner.ts`
   * Configured with `"tool": "Centauri Aegis Evolve"`.
2. **Report Generator Headers & Footers**:
   * *Location*: `src/components/report-generator.tsx`
   * Report templates configured with `# Centauri Aegis AI Security Assessment Report`, assessor stamp `Centauri Aegis AI Security Testing & Research`, and unified terminology.
3. **Session Manager Subtitle**:
   * *Location*: `src/components/session-manager.tsx`
   * Subtitle configured with `"Export, import, and manage your Centauri Aegis session data"`.
4. **Logo Sizing Flexibility**:
   * *Location*: `src/components/ui/logo.tsx`
   * Expanded `LogoProps` size definition to `'sm' | 'md' | 'lg' | 'xl' | number` with automatic fallback.
5. **Settings View Hook Lifecycle**:
   * *Location*: `src/components/settings-view.tsx`
   * Streamlined auth status checking and removed unused imports.

---

## 3. Automated & Security Testing Results

### 3.1 Live API Security Verification
* **SSRF Shielding**: Verified that requests to private IP ranges and cloud metadata endpoints (`169.254.169.254`) are strictly blocked in production.
* **Key Vault Isolation**: Target credentials stored in server-side in-memory AES-256-GCM vault; client receives only opaque handle `kv_...`.
* **Authentication Controls**: Verified status detection, login verification, and rate limiting endpoints.

### 3.2 Core Workflows & Export Integrity
* **JSON Export**: Verified header metadata specifies `Centauri Aegis AI Security Testing & Research`.
* **SARIF Export**: Verified OASIS SARIF v2.1.0 compliance, driver `Centauri Aegis`, and rule IDs `centauri-aegis/<category>`.
* **Heuristic Scoring**: Validated breach classification, statistical refusal heuristics, and grade assignment (A+ to F).
* **Session Sanitization**: Verified that sensitive API keys and authorization headers are automatically stripped prior to export.

---

## 4. Quality Gates Sign-Off

The Centauri Aegis platform satisfies all verification criteria.
