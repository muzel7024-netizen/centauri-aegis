# Centauri Aegis — Release Notes

## Version 1.1.0 — Production Release

Centauri Aegis v1.1.0 represents the first production release, introducing enterprise lifecycle synchronization, hardened STOP execution controls, authoritative probe progress telemetry, and a one-click authenticated Windows launcher.

### What's New in v1.1.0

#### 1. Authoritative Execution Lifecycle & Synchronization
* **Unified Source of Truth**: Full bi-directional synchronization between `Assessment` and `AttackRun` entities across Assessment Workspace, Executive Reports, Findings, and Results.
* **Cooperative STOP Cancellation**: Instant halting of in-flight execution streams and background worker loops via propagated `AbortSignal` and stream cancellation.
* **Deterministic Probe Accounting**: Guaranteed numerator/denominator accounting directly derived from store-level terminal results (`results.length`), eliminating ephemeral counter resets across navigation and remounts.
* **Terminal State Idempotency**: Immutable resolution ensuring cancelled runs cannot be overwritten by late completion callbacks, and vice versa.

#### 2. Windows Portable Deployment & Launcher
* **One-Click Launch**: Double-clickable `start-centauri.bat` launcher that automatically provisions or detects the Node.js runtime, generates local administrator credentials, and opens the console in the default browser.
* **Local Storage Isolation**: User credentials securely persisted under `%LOCALAPPDATA%\CentauriAegis\credentials.json` with file-level permissions.
* **Dedicated Reset Utility**: `reset-credentials.bat` for secure password rotation without disrupting existing assessment databases.

#### 3. Security Hardening & SSRF Defense
* **Strict IMDS Block**: Unconditional interception of requests to AWS/GCP/Azure instance metadata endpoints (`169.254.169.254`).
* **Authenticated Session Cookies**: Cryptographically verified HMAC-SHA256 session tokens.
* **Rate Limiting & Proxy Protection**: Token bucket rate limiter with trusted proxy validation.

#### 4. Interface & Ergonomics
* **Grey Ghost / Matte Black Theme**: AMOLED and Slate dark theme paired with an accessible, high-contrast Light Mode.
* **Keyboard Shortcut Matrix**: Rapid keyboard navigation (`Ctrl+1` through `Ctrl+0`, `Ctrl+Enter`, `Ctrl+.`).

---

## Version 1.0.0 — Baseline Release

Centauri Aegis is an independent AI security testing and research platform engineered for automated adversarial evaluation, jailbreak resistance auditing, and safety assessment of modern Large Language Models and AI systems.

### Key Capabilities & Highlights

#### Core Adversarial Testing Engine
* **221 Curated Adversarial Payloads**: Comprehensive test suites spanning 7 OWASP LLM Top 10 threat categories:
  * Prompt Injections (direct system instruction override)
  * Jailbreaks (persona hijacking, adversarial hypotheticals, safety bypasses)
  * System Prompt & Data Extraction
  * Guardrail & Content Filter Bypasses
  * Tool Abuse & Function Injection
  * Multi-Turn Conversational Escalations
  * Obfuscated Multi-Encoding Vectors (Base64, Hex, ROT13, Leetspeak, Unicode)
* **Concurrent Execution Dispatcher**: Parallel attack delivery (1 to 10 concurrent streams) with real-time progress accounting and immediate cooperative cancellation.
* **Target Management**: Multi-provider support for OpenAI, Anthropic Claude, Ollama, vLLM, and arbitrary custom HTTP endpoints.

#### Assessment Workspace & Findings Synthesis
* **Structured Assessment Workflows**: Scoped campaigns with target assignment, category filtering, variant generators, and live telemetry tracking.
* **Empirical Findings Register**: Automated vulnerability synthesis grouping successful breaches into actionable security findings with severity grading, affected test lists, and remediation guidance.
* **Status Lifecycle**: Track findings across `open`, `in_review`, `mitigated`, `accepted`, and `false_positive` states.

#### Multi-Turn & Advanced Testing Modules
* **Attack Chains**: Multi-stage conversational pipeline builder with step transforms, dynamic variable slots (`{{previous_response}}`), and sequential context manipulation.
* **Genetic Evolve Engine**: Fitness-directed prompt mutation with ancestor lineage graphs and branch metrics.
* **Adaptive Testing**: Vulnerability pattern analysis and automated follow-up probe generation.
* **Regression Testing**: Baseline comparison to verify vulnerability remediation across model versions.
* **Multi-Target Comparison**: Side-by-side evaluation of 2–4 models using identical test suites.

#### Heuristic Classification & Scoring
* **Zero-Overhead Classifier**: 11-language refusal, compliance, hedging, and leak classification engine operating without external LLM inference costs.
* **Custom Scoring Rubrics**: Configurable category and severity weighting with grade outputs (A+ to F).

#### Enterprise Security & Compliance
* **SSRF Guard**: Strict transport controls unconditionally blocking cloud metadata (IMDS `169.254.169.254`) and policy-controlled private subnets.
* **Encrypted In-Memory Key Vault**: Target credentials secured with AES-256-GCM server-side encryption; zero plaintext storage in browser local storage.
* **Compliance Reporting & Exports**: Detailed Markdown assessment reports, CSV metrics, and SARIF 2.1.0 standard output for GitHub Advanced Security and enterprise SIEM ingest.

---

### Quick Start

```bash
# Clone the repository
git clone <repository-url> && cd centauri-aegis

# Install dependencies cleanly
npm ci

# Start the development server
npm run dev
```

### Docker Deployment

```bash
docker build -t centauri-aegis .
docker run -p 3000:3000 centauri-aegis
```
