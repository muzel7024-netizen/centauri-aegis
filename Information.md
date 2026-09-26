# Information.md

This file provides architectural guidance when working with code in this repository.

## What This Is

Centauri Aegis is an AI security testing and research platform designed for automated adversarial red-teaming, jailbreak resistance evaluation, and safety auditing of Large Language Models and AI systems. It sends targeted attack payloads across 7 threat categories to model endpoints, evaluates responses using a zero-overhead heuristic classification engine, synthesizes empirical findings, and exports compliance-grade reports. Built strictly for authorized security testing and research.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint (v9 flat config)
npm test         # Run test suite via Vitest (390 tests)
npm run test:watch    # Watch mode
npm run test:coverage # Run with coverage
```

Docker: `docker build -t centauri-aegis . && docker run -p 3000:3000 centauri-aegis`

**Testing:** Vitest + jsdom. Tests live in `src/lib/__tests__/` (19 test files). Vitest globals are enabled. Use `npm ci` (not `npm install`) to respect package-lock.json.

## Architecture

**Stack:** Next.js 16 App Router + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui + Zustand 5

**All components are client-side** (`"use client"` directive). The app uses a modular single-page layout where `src/app/page.tsx` switches views based on `store.view` state. Views:
`config | attacks | results | reports | chains | session | editor | comparison | adaptive | evolve | heatmap | regression | scoring | assessments | findings | settings | about`

### Data Flow

1. User configures LLM target (endpoint, API key, model, provider) in Target Configuration
2. Target API keys are immediately vaulted server-side via `POST /api/keys` returning an opaque handle (`apiKeyId`)
3. User selects attack categories/payloads and executes an assessment
4. Runner dispatches requests to `POST /api/attack` (streaming NDJSON) or sequential chains (`POST /api/chain`)
5. Each result includes a heuristic `AnalysisResult` (pattern-matching classifier across 11 languages, no LLM grading)
6. Results and findings are persisted in Zustand store (`"centauri-aegis-state"`) with legacy fallback support
7. Reports and findings are exported to Markdown, CSV, and SARIF 2.1.0

### Key Modules

| Module | Purpose |
|---|---|
| `src/lib/store.ts` | Central Zustand store (`useStore` hook) with persist middleware. Persisted: targets, activeTargetId, selectedCategories, runs, activeRunId, concurrency, assessments, findings. NOT persisted: view, isRunning, cancelActiveExecution. Plaintext `apiKey` stripped via `partialize`. |
| `src/lib/types.ts` | Core TypeScript interfaces: `TargetConfig`, `AttackPayload`, `AttackResult`, `AnalysisResult`, `AttackRun`, `AttackChain`, `Assessment`, `Finding`. |
| `src/lib/llm-client.ts` | Multi-provider client for OpenAI, Anthropic, Ollama, and Custom endpoints with timeout and cancellation controls. |
| `src/lib/analysis.ts` | Heuristic response classifier with refusal, compliance, explanation, and leak detection across 11 languages. |
| `src/lib/findings.ts` | Empirical vulnerability synthesizer — groups breaches by category and severity into structured findings. |
| `src/lib/chains.ts` | Sequential multi-step attack pipelines with dynamic variable interpolation (`{{previous_response}}`). |
| `src/lib/variants.ts` | 20 payload transformations (case, unicode homoglyphs, base64, ROT13, leetspeak, etc.). |
| `src/lib/attacks/*.ts` | 221 curated payloads across 7 threat categories (`inj-*`, `jb-*`, `ext-*`, `byp-*`, `ta-*`, `mt-*`, `enc-*`). |
| `src/lib/evolve/runner.ts` | Genetic algorithm mutation engine with fitness evaluation and lineage tracking. |
| `src/lib/adaptive.ts` | Weakness profiler generating automated follow-up attack strategies. |
| `src/lib/scoring.ts` | Custom weighted scoring rubrics with letter grade outputs (A+ to F). |
| `src/lib/persistence.ts` | Session import/export, schema validation, merge deduplication, and legacy namespace migration. |
| `src/lib/export.ts` | Export engine for JSON, CSV, and SARIF 2.1.0 formatted findings. |

### Visual Theme & Tokens

- Theme: Graphite / Charcoal / Slate / Steel-Blue (`--background: #08090B`, elevated cards `--card: #12151A`, primary accent `--primary: #5B8DB8` / `--aegis: #5B8DB8`).
- Semantic tokens: `--destructive: #C94A4A` (rose), `--warning: #C9973E` (amber), `--success: #3FA66B` (emerald).
- No emojis anywhere in the interface; Lucide SVG icons exclusively.

### Authentication

Auth is opt-in via environment variables:
- `AEGIS_AUTH_ENABLED=true`
- `AEGIS_USERNAME` and `AEGIS_PASSWORD`

### Server-Side Key Vault

API keys are stored server-side in an encrypted in-memory vault (`AES-256-GCM`). Client-side state retains only the opaque `apiKeyId` and masked `apiKeyLabel` (e.g., `sk-...abc`). Plaintext keys are never stored in browser `localStorage`.
