# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

RedPincer is an AI/LLM red-teaming suite for testing model safety. It sends attack payloads (prompt injection, jailbreak, extraction, bypass) to LLM endpoints, analyzes responses with a heuristic engine, and reports vulnerabilities. Built for authorized security testing only.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint (v9 flat config)
```

Docker: `docker build -t redpincer . && docker run -p 3000:3000 redpincer`

**Testing:** Vitest + jsdom. Run `npm test` (single run), `npm run test:watch` (watch mode), `npm run test:coverage` (with coverage). Tests live in `src/lib/__tests__/` (14 test files, 357 tests). Vitest globals are enabled — `describe`/`it`/`expect` need no imports. Coverage tracks `src/lib/**/*.ts` excluding `src/lib/attacks/**`. Use `npm ci` (not `npm install`) to respect the lockfile.

## Architecture

**Stack:** Next.js 16 + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui (new-york style) + Zustand 5

**All components are client-side** (`"use client"` directive). There are no server components. The app uses a single-page layout where `src/app/page.tsx` switches views based on `store.view` state. Views: `config | attacks | results | reports | chains | session | editor | comparison | adaptive | heatmap | regression | scoring`

### Data Flow

1. User configures LLM target (endpoint, API key, model, provider) in `TargetConfig`
2. User selects attack categories/payloads and hits RUN
3. `POST /api/attack` streams NDJSON — one `AttackResult` per payload
4. Each result includes heuristic `AnalysisResult` (pattern-matching, no LLM grading)
5. Results stored in Zustand → persisted to localStorage (`"redpincer-state"`)

### Key Modules

| Module | Purpose |
|---|---|
| `src/lib/store.ts` | Zustand store (`useStore` hook) with persist middleware. Persisted via `partialize`: targets, activeTargetId, selectedCategories, runs, activeRunId, concurrency. NOT persisted: view, isRunning. |
| `src/lib/types.ts` | All TypeScript interfaces and enums. Core types: `TargetConfig`, `AttackPayload`, `AttackResult`, `AnalysisResult`, `AttackRun`, `AttackChain` |
| `src/lib/llm-client.ts` | Multi-provider client. OpenAI/OpenRouter use chat.completions format; Anthropic uses Messages API with top-level `system` param. 30s timeout. |
| `src/lib/analysis.ts` | Heuristic response classifier with refusal, compliance, explanation, and hedging pattern detection in 11 languages (EN, ES, FR, DE, PT, RU, ZH, JA, KO, AR, IT). Context-aware analysis prevents false positives (e.g., decoding base64 + refusing = refusal, not breach). Outputs classification + severity score (1-10) + confidence (0-1). |
| `src/lib/chains.ts` | Sequential multi-step attacks. Steps support `{{previous_response}}` and `{{step:stepId}}` template variables. Response transforms: full, extract_json, extract_code, first_line, last_paragraph. |
| `src/lib/variants.ts` | 20 payload transformations (case, unicode homoglyphs, base64, ROT13, leetspeak, zero-width spaces, etc.) |
| `src/lib/attacks/*.ts` | 222 payloads across 7 categories with id format `inj-001`, `jb-001`, `ext-001`, `byp-001`, `ta-001`, `mt-001`, `enc-001` |
| `src/lib/adaptive.ts` | Weakness analysis engine — examines run results to identify vulnerability patterns and generate follow-up strategies |
| `src/lib/scoring.ts` | Custom scoring rubric system — weighted scoring by category, severity, classification with letter grades |
| `src/lib/keyboard-shortcuts.ts` | Shortcut definitions, view mappings, input detection, formatting utilities |
| `src/lib/use-keyboard-shortcuts.ts` | React hook for global keyboard shortcut handling (dispatches custom events for run/stop) |
| `src/lib/persistence.ts` | Session import/export, validation, merge (dedup by id), localStorage helpers, sanitization (strips API keys), size utilities |
| `src/lib/export.ts` | Structured data export — JSON (full results), CSV (flat table), SARIF v2.1.0 (industry standard for security tools) |

### API Routes

- `POST /api/attack` — Streams attack results as NDJSON. Supports AbortController for stop functionality. Accepts `{endpoint, apiKey, model, provider, categories?, payloadIds?, concurrency?}`. Concurrency (1-10, default 1) controls parallel LLM requests — higher values run faster but may trigger provider rate limits.
- `POST /api/chain` — Executes chain steps sequentially with template resolution
- `POST /api/test-connection` — Validates LLM endpoint connectivity
- `POST /api/models` — Fetches available models from provider API (OpenAI, Anthropic hardcoded list, OpenRouter)
- `POST /api/generate-payload` — Uses target LLM to generate new attack payloads via meta-prompting
- `POST /api/generate-adaptive` — Uses target LLM to generate follow-up attacks based on weakness profile
- `POST /api/explain` — Uses target LLM to explain why an attack result was classified as it was
- `POST /api/mutate-payload` — Uses target LLM to mutate a blocked payload into a new bypass attempt
- `POST /api/summarize-run` — Uses target LLM to generate executive summary of an attack run
- `POST/DELETE/GET /api/keys` — API key vault CRUD (store, remove, check existence)

### Styling

- Dark mode is hardcoded (`.dark` class on `<html>`)
- Custom OKLCH color tokens in `src/app/globals.css`: `redpincer` (red), `lobster` (orange), `success` (green), `warning` (yellow)
- Use `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes
- Icons from `lucide-react`, toasts from `sonner`

### Authentication

Auth is **opt-in** via environment variables. When `PINCER_USERNAME` and `PINCER_PASSWORD` are both set, all routes are protected by session-based auth with HMAC-signed cookies. Set `PINCER_AUTH_DISABLED=true` to explicitly disable. See `.env.example`.

| Module | Purpose |
|---|---|
| `src/lib/auth.ts` | Core auth logic — credential validation (timing-safe), HMAC session tokens, config |
| `src/lib/use-auth.ts` | Client-side React hook for auth status + logout |
| `src/middleware.ts` | Next.js middleware — redirects unauthenticated requests to `/login`, returns 401 for API routes |
| `src/app/login/page.tsx` | Login page with form |
| `src/app/api/auth/login/route.ts` | POST — validates credentials, sets httpOnly session cookie |
| `src/app/api/auth/logout/route.ts` | POST — clears session cookie |
| `src/app/api/auth/status/route.ts` | GET — returns auth state (enabled, authenticated, username) |

### API Key Vault

API keys are stored server-side in an encrypted in-memory vault (AES-256-GCM), not in localStorage. Client-side only stores an opaque `apiKeyId` and a masked `apiKeyLabel` (e.g., "sk-...abc"). Keys are encrypted with `PINCER_KEY_SECRET` (falls back to `PINCER_SESSION_SECRET` / `PINCER_PASSWORD`). On server restart, the vault is empty — users re-enter keys.

| Module | Purpose |
|---|---|
| `src/lib/key-vault.ts` | AES-256-GCM encrypted storage, key CRUD, `resolveApiKey()` for backward compat |
| `src/lib/resolve-key.ts` | Shared helper for API routes — resolves `apiKeyId` or legacy `apiKey` |
| `src/lib/target-utils.ts` | Client-side helper — `getTargetKeyFields(target)` for API request bodies |
| `src/app/api/keys/route.ts` | POST (store key → keyId), DELETE (remove), GET (check existence) |

All API routes accept both `apiKeyId` (vault reference) and `apiKey` (plaintext, backward compat). The store's `partialize` strips plaintext `apiKey` before persisting to localStorage.

### Rate Limiting

All API routes are rate-limited via in-memory sliding window (enforced in `src/middleware.ts`). Always active — no configuration needed. Resets on server restart.

| Tier | Routes | Limit |
|---|---|---|
| `auth` | `/api/auth/*` | 5 req / 60s (brute-force protection) |
| `attack` | `/api/attack`, `/api/chain`, `/api/generate-adaptive` | 10 req / 60s |
| `api` | All other `/api/*` | 30 req / 60s |

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`) are included on all API responses. 429 responses include `retryAfter` in the JSON body.

| Module | Purpose |
|---|---|
| `src/lib/rate-limit.ts` | Rate limiter class, tier config, route-to-tier mapping, client key extraction, header helpers |

## Conventions

- Path alias: `@/*` maps to `./src/*`
- Use `import type` for TypeScript-only imports
- shadcn/ui components live in `src/components/ui/` — add new ones via `npx shadcn add <component>`
- Provider enum values: `"openai" | "anthropic" | "openrouter" | "custom"`
- Attack categories: `"injection" | "jailbreak" | "extraction" | "bypass" | "tool_abuse" | "multi_turn" | "encoding"`
- Run a single test file: `npx vitest run src/lib/__tests__/analysis.test.ts`
