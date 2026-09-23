# Centauri Aegis — Production-Readiness & Distribution Audit

**Document Version**: 1.0.0  
**Target Codebase**: Centauri Aegis v1.1  
**Git Checkpoint**: `8238ca7a2ba3d6c1f5705ac75fd1f427c7620815`  
**Audit Date**: September 24, 2026  
**Auditor**: Antigravity Quality & Security Research  
**Status**: **Conditionally Production-Ready** (2 High-Severity Fixes Required Before External Distribution)

---

## 1. Executive Summary

A comprehensive production-readiness audit was conducted on the Centauri Aegis v1.1 codebase to evaluate its technical suitability for packaging and distribution to authorized security researchers and colleagues.

The platform demonstrates high core stability, clean client/server separation, robust zero-overhead scoring heuristics, excellent cryptographic API key isolation (AES-256-GCM in-memory vault), and 100% test suite compliance (19/19 test files, 390/390 tests passing).

However, the audit identified **two specific high-severity security issues** that must be resolved prior to distributing the application for multi-user or network-accessible deployments:
1. **Middleware Authentication Cryptographic Verification Gap**: The Next.js middleware checks for the presence of the `aegis_session` cookie but does not verify its cryptographic HMAC signature, leaving API route handlers vulnerable to bypass via arbitrary cookie values if individual routes do not validate the token.
2. **Incomplete SSRF Guard Coverage Across Auxiliary AI Routes**: While `/api/attack`, `/api/test-connection`, `/api/models`, `/api/chain`, and `/api/evolve` enforce `validateTargetEndpoint()`, five auxiliary AI routes (`/api/explain`, `/api/generate-adaptive`, `/api/generate-payload`, `/api/mutate-payload`, and `/api/summarize-run`) dispatch outbound HTTP requests via `sendLLMRequest()` without validating the target endpoint against the SSRF guard.

Once these two items are addressed, Centauri Aegis is technically ready for standalone Windows packaging or local web-server distribution.

---

## 2. Current Architecture

Centauri Aegis is structured as a modern full-stack Next.js application:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Centauri Aegis Frontend                         │
│   Next.js 16 (App Router) • React 19 • Tailwind CSS • Lucide • Sonner  │
│   Zustand (Client State) • LocalStorage (Persistence) • In-Memory Refs  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / NDJSON Streams
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Next.js Server / Middleware                       │
│   src/middleware.ts : Sliding-Window Rate Limiter & Cookie Route Guard │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴────────────────────────┐
          ▼                                                  ▼
┌──────────────────────────────────┐        ┌────────────────────────────┐
│      Server-Side API Routes      │        │    In-Memory Key Vault     │
│   /api/attack    /api/models     │        │    AES-256-GCM Encryption  │
│   /api/chain     /api/evolve     │◄───────┤    Process-Bound Entropy   │
│   /api/explain   /api/auth/*     │        │    Opaque Key IDs (kv_...) │
└─────────────────┬────────────────┘        └────────────────────────────┘
                  │ Outbound LLM Requests
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Security & LLM Engine                          │
│   src/lib/endpoint-security.ts : SSRF Guard (IMDS, Private Subnets)    │
│   src/lib/llm-client.ts        : Provider Dispatcher                   │
│   src/lib/analysis.ts          : 11-Language Zero-Overhead Heuristics  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        External Target Models                          │
│     OpenAI • Anthropic Claude • Ollama • vLLM • Custom Gateways        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Production Readiness Assessment

| Area | Status | Readiness Level | Summary |
| :--- | :---: | :---: | :--- |
| **Build & Compilation** | **PASS** | High | Standalone build compiles cleanly; 19 routes static/dynamic. |
| **Authentication Flow** | **WARN** | Medium | Login/logout/token signing is solid, but middleware signature validation needs route-level enforcement. |
| **Secret & Key Vault** | **PASS** | High | API keys never persist in localStorage; AES-256-GCM in-memory encryption. |
| **Network & SSRF Guard** | **WARN** | Medium | Strong IMDS & private IP blocking on primary routes; 5 auxiliary routes missing the guard. |
| **Rate Limiting** | **PASS** | High | In-memory sliding window token bucket; 3 functional tiers (auth, attack, api). |
| **Execution Reliability**| **PASS** | High | Probe deduplication, cooperative abort cancellation, stable ID associations. |
| **Data Integrity** | **PASS** | High | Versioned schema, quota catch handlers, clean cascading deletion. |
| **Client/Server Boundary**| **PASS** | High | Zero server secrets leak into client bundles; strict separation verified. |

---

## 4. Authentication & Session Security Audit

### 4.1 Token Generation & Verification
- **Mechanism**: HMAC-SHA256 tokens (`<base64url-payload>.<base64url-sig>`) in [src/lib/auth.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/lib/auth.ts).
- **Payload**: Contains subject username, issued-at (`iat`), expiration (`exp`, 24 hours), and cryptographically random unique nonce (`jti`).
- **Timing Attack Defense**: Employs `crypto.timingSafeEqual` for both credential comparison and token signature validation.
- **Cookie Security**:
  - `httpOnly: true` (inaccessible to JavaScript)
  - `sameSite: "lax"` (CSRF protection)
  - `secure: process.env.NODE_ENV === "production"` (automatically enforced on HTTPS in production)
  - `path: "/"`

### 4.2 Findings & Security Analysis
- **Finding SEC-AUTH-01 (High Severity)**: Middleware signature bypass.
  - In [src/middleware.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/middleware.ts#L110-L130), `applyAuthCheck` checks `request.cookies.get("aegis_session")?.value`. If the cookie is non-empty, it allows the request through. The cryptographic signature is only verified when `/api/auth/status` is queried by the frontend.
  - If a client issues direct API requests (`curl`, Postman) with `Cookie: aegis_session=invalid`, the middleware permits the request and downstream routes (`/api/attack`, `/api/keys`) execute without verifying token authenticity.
- **Remediation**: Enforce cryptographic validation in middleware or add a `verifySessionOrReject()` helper at the start of protected route handlers.

---

## 5. Secret & API-Key Audit

### 5.1 Provider API Key Lifecycle
1. **Entry**: Target Configuration modal accepts API key from user.
2. **Vault Ingest**: Client invokes `POST /api/keys`. `src/lib/key-vault.ts` generates a cryptographically random `keyId` (`key_<24-hex-chars>`), masks the key for UI preview (`sk-...abcd`), encrypts the plaintext with AES-256-GCM, and stores it in server memory.
3. **Client Persistence**: Only `apiKeyId` and `apiKeyLabel` are saved in Zustand and browser `localStorage`. Plaintext keys are **never** written to browser storage.
4. **Execution**: When attacks are dispatched, the client sends `apiKeyId`. The server resolves `apiKeyId` $\rightarrow$ plaintext inside `resolveKeyFromBody()`, passes it into the LLM HTTP header, and discards the string upon request completion.
5. **Export Sanitization**: `src/lib/persistence.ts` (`sanitizeSessionForExport`) explicitly strips both `apiKey` and `apiKeyId` before JSON/SARIF export.

### 5.2 Vault Key Derivation
- Master encryption key derived via SHA-256 from `AEGIS_KEY_SECRET`, `AEGIS_SESSION_SECRET`, or `AEGIS_PASSWORD`.
- If no environment secret is configured, an ephemeral 256-bit random key is generated per process.
- **Finding SEC-KEY-01 (Low / Operational)**: Multi-worker clustered deployments without a set `AEGIS_KEY_SECRET` will generate different ephemeral keys per worker process.
- **Remediation**: Document that production deployments with multiple worker processes should configure `AEGIS_KEY_SECRET`.

---

## 6. SSRF & Network Security Audit

### 6.1 SSRF Guard Architecture (`src/lib/endpoint-security.ts`)
- **Metadata Protection**: Unconditionally blocks `169.254.169.254` (AWS/Azure/GCP IMDS), `metadata.google.internal`, `instance-data`, `fd00:ec2::254`, and any host starting with `169.254.`.
- **Private Subnet Protection**: In production (`NODE_ENV === "production"`), blocks RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopbacks (`127.0.0.0/8`, `localhost`, `::1`), link-local, and Carrier-Grade NAT (`100.64.0.0/10`) unless `AEGIS_ALLOW_PRIVATE_TARGETS=true`.
- **Protocol Enforcement**: Restricts schemes strictly to `http:` and `https:`.

### 6.2 Findings & Security Analysis
- **Finding SEC-SSRF-01 (High Severity)**: 5 AI generation routes bypass SSRF guard.
  - [src/app/api/explain/route.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/app/api/explain/route.ts)
  - [src/app/api/generate-adaptive/route.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/app/api/generate-adaptive/route.ts)
  - [src/app/api/generate-payload/route.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/app/api/generate-payload/route.ts)
  - [src/app/api/mutate-payload/route.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/app/api/mutate-payload/route.ts)
  - [src/app/api/summarize-run/route.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/app/api/summarize-run/route.ts)
  - Each of these endpoints accepts `endpoint` from the request JSON and passes it directly to `sendLLMRequest()`. An attacker can target IMDS or internal services through these endpoints.
- **Finding SEC-SSRF-02 (Medium Severity)**: HTTP 302 Redirect Following.
  - In [src/lib/llm-client.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/lib/llm-client.ts), `fetch(req.endpoint)` uses default `redirect: "follow"`. A public endpoint could respond with a 302 redirect to `http://169.254.169.254/latest/meta-data`.
- **Remediation**:
  1. Add `validateTargetEndpoint()` call to all 5 routes or enforce it inside `sendLLMRequest()`.
  2. Set `redirect: "manual"` or `redirect: "error"` in `src/lib/llm-client.ts`.

---

## 7. Rate Limiting & Abuse Controls Audit

### 7.1 Architecture
- Sliding window token bucket in [src/lib/rate-limit.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/lib/rate-limit.ts).
- Tiers:
  - `auth` (`/api/auth/*`): 5 requests / 60 seconds (prevents brute-force credential stuffing).
  - `attack` (`/api/attack`, `/api/evolve`, `/api/chain`, `/api/generate-adaptive`): 10 requests / 60 seconds.
  - `api` (all other API routes): 30 requests / 60 seconds.
- Header injection: Attaches standard RFC headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).
- Memory Management: Periodic interval cleanup every 60 seconds, evicting client buckets idle for $> 5$ minutes, using `.unref()` to avoid holding the Node.js event loop.

### 7.2 Findings & Security Analysis
- **Finding SEC-RATE-01 (Low / Informational)**: Client IP Key Collapsing.
  - In direct deployments without a reverse proxy (`AEGIS_TRUSTED_PROXY=false`), all clients collapse to key `"direct"`. Multiple colleagues connecting to a single instance would share rate limits.
- **Remediation**: For team deployments, run behind Nginx/Caddy with `AEGIS_TRUSTED_PROXY=true`.

---

## 8. Assessment Execution Reliability Audit

### 8.1 Workflow Verification
`Target Selection → Assessment Config → Runner Stream → Probe Deduplication → Results Dashboard → Findings Synthesis → SARIF/Markdown Export`

- **Cooperative Cancellation**:
  - `controller.abort()` in [src/components/assessment-runner.tsx](file:///c:/Users/rudra/Desktop/pincer-main/src/components/assessment-runner.tsx).
  - Registered globally in Zustand (`setCancelActiveExecution`).
  - Active NDJSON stream reader cancelled immediately via `readerRef.current?.cancel()`.
  - Sidebar STOP button, Assessment Runner STOP button, and `Ctrl+.` hotkey trigger the identical cancellation function.
- **Accounting Invariants**:
  - `completedProbeIdsRef` (`Set<string>`) guarantees probes are counted exactly once.
  - Clamping enforced in UI and store (`completed <= total`).
- **Finding REL-RUN-01 (Medium Severity)**: Unchecked HTTP Status in Assessment Runner.
  - In [src/components/assessment-runner.tsx](file:///c:/Users/rudra/Desktop/pincer-main/src/components/assessment-runner.tsx#L205), `res.body?.getReader()` is initialized without checking `if (!res.ok)`. If the backend returns 403 (SSRF blocked) or 429 (Rate limited), the stream finishes immediately, the catch block is bypassed, and the finally block marks the run as `"completed"` with a green success toast.
- **Remediation**: Add `if (!res.ok) { const err = await res.json(); toast.error(err.error); ... return; }` before reader initialization.

---

## 9. Persistence & Data Integrity Audit

### 9.1 Storage Schema
- **Namespace**: Exclusively `centauri-aegis-state` for Zustand, `centauri-aegis-rubrics` for scoring, `centauri-aegis-custom-payloads` for custom attack definitions, and `centauri-aegis-baselines` / `centauri-aegis-regression-runs` for regression testing.
- **Version**: Versioned at `1.1.0`.
- **Validation**: [src/lib/persistence.ts](file:///c:/Users/rudra/Desktop/pincer-main/src/lib/persistence.ts) (`validateSession`) validates every field, type, and category on imported files before passing them to the store.
- **Error Handling**: `saveToStorage` catches `QuotaExceededError` safely without crashing the UI.
- **Cascading Deletes**: Deleting an assessment in `src/lib/store.ts` automatically purges associated findings. Deleting a target maintains historical attack results while setting `activeTargetId: null`.

---

## 10. API Route Comprehensive Audit Matrix

| Route | Method | Auth Enforced? | SSRF Guarded? | Rate Limit Tier | Expected Response | Production Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/api/attack` | POST | Partial (Cookie Presence) | **YES** | `attack` (10/60s) | NDJSON Stream | **Ready** |
| `/api/auth/login` | POST | N/A (Login Endpoint) | N/A | `auth` (5/60s) | JSON `{ success }` | **Ready** |
| `/api/auth/logout` | POST | N/A (Logout Endpoint) | N/A | `auth` (5/60s) | JSON `{ success }` | **Ready** |
| `/api/auth/status` | GET | **YES** (Full HMAC) | N/A | `auth` (5/60s) | JSON `{ authenticated }` | **Ready** |
| `/api/chain` | POST | Partial (Cookie Presence) | **YES** | `attack` (10/60s) | NDJSON Stream | **Ready** |
| `/api/evolve` | POST | Partial (Cookie Presence) | **YES** | `attack` (10/60s) | NDJSON Stream | **Ready** |
| `/api/explain` | POST | Partial (Cookie Presence) | **NO (Fix Required)** | `api` (30/60s) | JSON `{ explanation }` | **Blocker** |
| `/api/generate-adaptive` | POST | Partial (Cookie Presence) | **NO (Fix Required)** | `attack` (10/60s) | JSON `{ attacks }` | **Blocker** |
| `/api/generate-payload` | POST | Partial (Cookie Presence) | **NO (Fix Required)** | `api` (30/60s) | JSON `{ payload }` | **Blocker** |
| `/api/keys` | POST/GET/DEL | Partial (Cookie Presence) | N/A | `api` (30/60s) | JSON `{ keyId, label }` | **Ready** |
| `/api/models` | POST | Partial (Cookie Presence) | **YES** | `api` (30/60s) | JSON `{ models }` | **Ready** |
| `/api/mutate-payload` | POST | Partial (Cookie Presence) | **NO (Fix Required)** | `api` (30/60s) | JSON `{ mutatedPrompt }` | **Blocker** |
| `/api/summarize-run` | POST | Partial (Cookie Presence) | **NO (Fix Required)** | `api` (30/60s) | JSON `{ summary }` | **Blocker** |
| `/api/test-connection` | POST | Partial (Cookie Presence) | **YES** | `api` (30/60s) | JSON `{ success, latency }` | **Ready** |

---

## 11. Error Handling & Failure Modes Audit

| Failure Scenario | System Response | Information Leakage Risk | Verdict |
| :--- | :--- | :--- | :--- |
| **Invalid Target API Key** | Upstream provider returns 401. Response surfaces `HTTP 401: Invalid API Key`. | None. Key is not repeated in error. | **Safe** |
| **Unreachable Host / DNS Error** | Caught by `llm-client.ts`, returns formatted error string and duration. | None. Standard network error. | **Safe** |
| **Request Timeout** | Timeout abort controller triggers at 120s (or 300s for reasoning models). | Returns `Request timed out after Xms`. | **Safe** |
| **Cloud Metadata Target** | Blocked immediately with HTTP 403 and explicit warning. | None. Target blocked before socket opened. | **Safe** |
| **Corrupted LocalStorage** | `try / catch` in JSON parse falls back to default empty array / state. | None. Application does not crash. | **Safe** |
| **Missing Secrets** | Falls back gracefully to process-bound ephemeral random entropy. | Console notice emitted; process continues. | **Safe** |

---

## 12. Logging & Observability Audit

- Grep audit confirmed **zero** server-side request payload logging.
- `src/lib/key-vault.ts` emits only a non-sensitive notice: `[Centauri Aegis] Notice: No AEGIS_KEY_SECRET set; using secure ephemeral in-memory vault key for this process.`
- Client-side error logging in React components utilizes standard `console.error()` for browser devtools diagnostics.
- No plaintext keys, credentials, or session cookies appear in any log output.

---

## 13. Client/Server Boundary Audit

- Verified that `src/lib/key-vault.ts` and `src/lib/auth.ts` are never imported into client components.
- Verified that `process.env` is never referenced in client components.
- Sensitive credentials reside strictly on the server in encrypted memory.
- Next.js Turbopack client manifests contain no server-only cryptographic utilities or secrets.

---

## 14. Dependency & Supply-Chain Review

- **Direct Runtime Dependencies**: 11 packages (all standard, high-reputation open-source packages: Next.js, React, Radix, Tailwind, Zustand, Lucide, Sonner, CVA, clsx).
- **Lockfile Status**: Valid `package-lock.json` present and synchronized.
- **Supply-Chain Advisory**: Next.js 16.1.6 contains known upstream advisories that are resolved in subsequent releases (`>=16.3.x`). Standard dependency updates should be scheduled as part of regular post-release maintenance.

---

## 15. Windows Distribution Assessment

Centauri Aegis is targeted for distribution to colleagues on Windows. Three potential packaging pathways were evaluated:

### Option A: Portable Local Web Server (Recommended First Step)
- **Feasibility**: **Immediate**.
- Next.js is already configured with `output: "standalone"` in [next.config.ts](file:///c:/Users/rudra/Desktop/pincer-main/next.config.ts).
- Package includes:
  - Standalone server bundle (`.next/standalone`, `.next/static`, `public`)
  - Embedded Node.js runtime for Windows (portable node.exe, ~35 MB)
  - A simple launcher script (`start-aegis.bat` / `start.ps1`) that executes `node server.js` and launches `http://localhost:3000` in Edge/Chrome.
- **Pros**: Zero installation required for colleagues, no compile-time native Windows SDK dependencies, 100% architectural fidelity.

### Option B: Native Desktop Packaging (Tauri v2 / Electron)
- **Feasibility**: High, but requires packaging overhead.
- Because Centauri Aegis relies on server-side Next.js route handlers for cryptographic key vaulting, streaming NDJSON, and SSRF guard execution, a desktop wrapper must either:
  1. Bundle the standalone Node.js server as a background sidecar process, OR
  2. Re-implement the API route layer in Tauri Rust IPC commands.
- **Recommendation**: Deploy Option A first; evaluate Option B for future releases.

### Option C: Docker Container Distribution
- **Feasibility**: **Ready**.
- Multi-stage Alpine [Dockerfile](file:///c:/Users/rudra/Desktop/pincer-main/Dockerfile) is verified and operational for containerized deployments.

---

## 16. Required Fixes Before Distribution (Release Blockers)

The following two issues must be resolved before releasing or distributing Centauri Aegis:

1. **[BLOCKER 1 - SSRF Guard] Connect `validateTargetEndpoint()` to all 5 auxiliary AI routes**:
   - Add target endpoint validation to:
     - `src/app/api/explain/route.ts`
     - `src/app/api/generate-adaptive/route.ts`
     - `src/app/api/generate-payload/route.ts`
     - `src/app/api/mutate-payload/route.ts`
     - `src/app/api/summarize-run/route.ts`
   - *Best Practice Hardening*: Also invoke `validateTargetEndpoint()` directly inside `sendLLMRequest()` in `src/lib/llm-client.ts` as an unconditional guard.

2. **[BLOCKER 2 - Auth Bypass] Enforce Cryptographic Session Verification on Protected API Routes**:
   - In `src/middleware.ts` or via a shared route helper `validateRequestAuth(request)`, verify the HMAC signature and expiration of `aegis_session` using `validateSessionToken()` so that forged or dummy cookies cannot access API routes.

---

## 17. Recommended Hardening After Distribution (Post-Release)

1. **Manual Redirect Policy on Outbound LLM Fetch**:
   - Configure `redirect: "error"` or `redirect: "manual"` in `src/lib/llm-client.ts` to prevent SSRF via 302 redirects.
2. **Assessment Runner Error State Handling**:
   - In `src/components/assessment-runner.tsx`, check `if (!res.ok)` to ensure that HTTP 4xx/5xx responses display an error toast and set assessment status to `"failed"` rather than falsely reporting completion.
3. **Asynchronous DNS IP Validation**:
   - Resolve DNS hostnames to verify that resolved IP addresses do not map to private subnets or link-local ranges before dispatching requests.
4. **Dependency Maintenance**:
   - Update `next` and transitive dependencies when Next.js patch releases stabilize.

---

## 18. Production Environment Variable Checklist

| Variable Name | Required? | Default / Fallback | Purpose |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | **Required** | `production` | Enables production security checks, disables private IP targets by default. |
| `PORT` | Optional | `3000` | Port for the HTTP server to listen on. |
| `HOSTNAME` | Optional | `0.0.0.0` | Binding host address (`0.0.0.0` or `127.0.0.1` for local-only). |
| `AEGIS_AUTH_ENABLED` | Optional | `false` | When `true`, enforces password authentication. |
| `AEGIS_USERNAME` | Conditional | `None` | Required if auth is enabled. Administrator login username. |
| `AEGIS_PASSWORD` | Conditional | `None` | Required if auth is enabled. Administrator login password. |
| `AEGIS_SESSION_SECRET` | Optional | Derived from password | 32-byte hex string used for HMAC signing session tokens. |
| `AEGIS_KEY_SECRET` | Optional | Ephemeral entropy | 32-byte key for encrypting API keys in the in-memory vault. |
| `AEGIS_ALLOW_PRIVATE_TARGETS` | Optional | `false` | Set to `true` to allow assessing local models (e.g. Ollama `localhost:11434`). |
| `AEGIS_TRUSTED_PROXY` | Optional | `false` | Set to `true` behind reverse proxies (Nginx, Caddy) for accurate rate limiting. |

---

## 19. Automated Verification Results

All automated quality gates passed cleanly with zero failures:

```
================================================================================
CENTAURI AEGIS QUALITY GATES
================================================================================
[x] Unit & Integration Tests : 19/19 test files passed, 390/390 tests passed (0 failures)
[x] TypeScript Compilation   : 0 errors (npx tsc --noEmit exited with code 0)
[x] ESLint Production Rules  : 0 errors, 57 warnings (npm run lint exited with code 0)
[x] Next.js Production Build : 19/19 routes generated cleanly in 12.5s (code 0)
[x] Git Whitespace Check     : 0 whitespace errors (git diff --check clean)
[x] Working Tree Status      : Clean (nothing to commit)
================================================================================
```

---

## 20. Final Release Recommendation

Centauri Aegis v1.1 is in an advanced state of production stability and visual refinement.

**Verdict**:
- For **local single-user testing on a trusted workstation**: The application is **Ready** to run today.
- For **multi-user distribution or networked deployment**: Address the **two release blockers** identified in Section 16 (SSRF guard coverage across auxiliary routes and cryptographic session verification on API routes).
