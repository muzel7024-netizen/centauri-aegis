# Centauri Aegis

**AI Security Testing & Research**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-5B8DB8.svg)](LICENSE)

Centauri Aegis is an enterprise-grade AI security testing and research platform engineered for automated adversarial evaluation, jailbreak resistance auditing, and safety compliance verification of Large Language Models (LLMs) and generative AI systems.

Centauri Aegis provides security engineers, red teams, and AI safety researchers with a systematic framework to probe model defenses, identify bypass vectors, synthesize actionable findings, and generate compliance-ready reports across leading commercial, open-weight, and self-hosted models.

---

> [!WARNING]
> **Authorized Security Testing and Research Notice**: Centauri Aegis is strictly designed for authorized security evaluation, vulnerability research, and defensive hardening. Always ensure you have explicit, documented authorization to test the target AI models and infrastructure.

---

## Architecture & Core Modules

```
                    Target Configuration & In-Memory Key Vault
                                       │
                                       ▼
                             Assessment Workspace
                    [Campaign Scoping & Execution Dispatcher]
                                       │
                ┌──────────────────────┼──────────────────────┐
                ▼                      ▼                      ▼
        Adversarial Payloads     Attack Chains         Evolve Engine
        (221 Curated Probes)   (Multi-Turn Logic)   (Genetic Mutations)
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       ▼
                       Zero-Overhead Heuristic Classifier
                     (11 Languages, Non-LLM Pattern Engine)
                                       │
                                       ▼
                               Findings Register
                     (Empirical Vulnerability Deduplication)
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
        Executive Reports                              Standard Exports
      (Markdown / Pen-Test)                          (SARIF 2.1.0 / CSV / JSON)
```

### 1. Assessment Workspace
* **Structured Campaigns**: Organize assessments with distinct operational scopes, target model bindings, attack category matrices, and mutation configurations.
* **Concurrent Dispatcher**: Calibrate parallel attack delivery from 1 to 10 concurrent streams with real-time telemetry, ETA estimations, and connection pool management.
* **Immediate Cooperative Cancellation**: Cooperative abort controls instantly halt active network streams and in-flight probes without losing completed results.

### 2. Empirical Findings Register
* **Automated Finding Synthesis**: Successful attack breaches are aggregated and deduplicated into structured security findings by category and severity.
* **Evidence Preservation**: Monospace, bounded evidence viewing stores raw model responses, detected indicators, and execution timings.
* **Status Lifecycle**: Manage findings across standard security states: `Open`, `In Review`, `Mitigated`, `Accepted Risk`, and `False Positive`.

### 3. Attack Categories & Curated Modules
Centauri Aegis incorporates 221 curated payloads spanning 7 OWASP LLM Top 10 threat categories:
* **Prompt Injection**: Subverting system instructions through direct adversarial directives and role overriding.
* **Jailbreaks**: Complex persona adoption, hypothetical framing, adversarial role-playing, and alignment suppression.
* **Data & Prompt Extraction**: Eliciting confidential system instructions, internal architecture details, and context data.
* **Guardrail & Content Bypass**: Probing boundary filters and safety classifiers for restricted topics.
* **Tool Abuse & Function Hijacking**: Exploiting function-calling schemas, parameter injection, and agentic multi-tool execution paths.
* **Multi-Turn Context Manipulation**: Gradual trust establishment and progressive context shifts over consecutive turns.
* **Multi-Encoding Vectors**: Hiding adversarial directives in Base64, Hex, ROT13, Leetspeak, and Unicode homoglyphs.

### 4. Advanced Testing Engines
* **Multi-Turn Attack Chains**: Build complex conversational attack trees with dynamic variable slotting (`{{previous_response}}`, `{{step:stepId}}`) and output transforms (JSON extraction, regex filtering).
* **Genetic Evolve Engine**: Algorithmic mutation engine using iterative feedback, fitness-directed prompt selection, and visual ancestor lineage tracking.
* **Adaptive Testing**: Post-run analysis identifying model weakness clusters and synthesizing targeted follow-up probes.
* **Regression Testing**: Baseline snapshot capture and automated differential testing to verify whether vulnerabilities have been mitigated across model versions.
* **Multi-Target Comparison**: Run identical adversarial matrices concurrently across multiple models to benchmark relative safety postures.

### 5. Zero-Overhead Heuristic Analysis & Scoring
* **Multilingual Classification Engine**: Evaluates model outputs in 11 languages (English, Spanish, French, German, Portuguese, Russian, Chinese, Japanese, Korean, Arabic, Italian) to identify refusals, partial compliance, full jailbreaks, and leaks without token overhead.
* **Custom Scoring Rubrics**: Configurable category and severity weightings yielding objective numerical safety scores and letter grades (A+ to F).

### 6. Reports & Compliance Exports
* **Executive Security Reports**: 10-section professional audit documents including executive summaries, risk matrices, detailed finding appendices, and targeted remediations.
* **Standard SARIF 2.1.0 Output**: Full compatibility with GitHub Advanced Security, Microsoft Defender for Cloud, and enterprise SIEM platforms.
* **Data Formats**: Structured JSON results and flat CSV tables for spreadsheet analysis.

---

## Security Architecture

### Strict SSRF Protection
* **Cloud Instance Metadata (IMDS)**: Unconditionally blocks requests targeting `169.254.169.254` and link-local addresses across all providers.
* **Private Network Controls**: Localhost and RFC 1918 subnets are restricted in production environments unless explicitly authorized via `AEGIS_ALLOW_PRIVATE_TARGETS=true`.

### Server-Side In-Memory Key Vault
* API keys are never stored in browser `localStorage`.
* Target credentials are encrypted in-memory on the server using AES-256-GCM backed by process-bound entropy.
* Browsers retain only opaque cryptographic handles (`apiKeyId`) and masked labels (`sk-...abc`).

### Reverse Proxy & Authentication
* Session-based authentication using HMAC-signed cookies and timing-safe credential verification.
* Reverse proxy IP resolution strictly verifies trusted proxy headers when `AEGIS_TRUSTED_PROXY=true`.

---

## Installation & Setup

### Prerequisites
* **Node.js**: Version 20.x or 22.x LTS
* **npm**: Version 10.x or later

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd centauri-aegis

# Cleanly install dependencies
npm ci

# Start the development server
npm run dev
```

Navigate to `http://localhost:3000` to access the console.

### Production Build

```bash
# Compile optimized Next.js bundle
npm run build

# Start production server
npm start
```

### Docker Deployment

```bash
# Build production container image
docker build -t centauri-aegis .

# Run container with private target support
docker run -p 3000:3000 -e AEGIS_ALLOW_PRIVATE_TARGETS=true centauri-aegis
```

---

## Environment Configuration

Configure the platform using a `.env` file or container environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AEGIS_AUTH_ENABLED` | Enforce login authentication on console routes | `false` |
| `AEGIS_USERNAME` | Administrator username for console access | `admin` |
| `AEGIS_PASSWORD` | Administrator password for console access | `None` |
| `AEGIS_SESSION_SECRET` | HMAC signing secret for session cookies | Derived from password |
| `AEGIS_KEY_SECRET` | 32-byte master encryption key for key vault | Process entropy |
| `AEGIS_ALLOW_PRIVATE_TARGETS` | Allow targeting internal/private IP ranges in production | `false` |
| `AEGIS_TRUSTED_PROXY` | Trust reverse proxy headers (`X-Forwarded-For`) | `false` |

*(Note: Legacy `PINCER_*` environment variables remain supported as migration fallbacks).*

---

## Keyboard Shortcuts

| Shortcut | View / Action |
| :--- | :--- |
| `Ctrl+1` | Target Configuration |
| `Ctrl+2` | Attack Modules |
| `Ctrl+3` | Results Dashboard |
| `Ctrl+4` | Executive Reports |
| `Ctrl+5` | Attack Chains |
| `Ctrl+6` | Session Manager |
| `Ctrl+7` | Payload Editor |
| `Ctrl+8` | Run Comparison |
| `Ctrl+9` | Adaptive Runner |
| `Ctrl+0` | Vulnerability Heatmap |
| `Ctrl+Enter` | Execute Attack Run |
| `Ctrl+.` | Stop Active Execution |
| `Ctrl+/` | View Shortcuts Modal |

---

## Verification & Testing

Centauri Aegis includes a comprehensive test suite covering the heuristic analysis engine, key vault security, persistence migration, scoring rubrics, and assessment flows:

```bash
# Execute full Vitest suite (390+ tests)
npm test

# Run ESLint validation
npm run lint

# Run strict TypeScript type checks
npx tsc --noEmit

# Test production compilation
npm run build
```

---

## License & Attribution

Centauri Aegis is released under the **MIT License**. See [LICENSE](LICENSE) for full legal terms.

Third-party dependencies and upstream open-source attributions are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

* **Project**: Centauri Aegis
* **Tagline**: AI Security Testing & Research
* **Developer**: rudrakshp20-hue (@NeelaBillota)
