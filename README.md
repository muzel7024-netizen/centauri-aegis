# Centauri Aegis

**AI Security Testing & Research**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

Centauri Aegis is an advanced AI security testing and research console designed for adversarial red-teaming, jailbreak resistance evaluation, and automated safety auditing of Large Language Models and AI systems.

Point Centauri Aegis at any model endpoint (OpenAI, Anthropic Claude, Ollama, vLLM, or Custom API), select your adversarial modules, and execute automated penetration testing assessments with real-time streaming results, zero-overhead heuristic classification, and compliance-ready exports.

---

> [!WARNING]
> **Centauri Aegis is engineered for authorized security testing and research only.** Use it to audit AI systems you own or have explicit authorization to assess. Never deploy adversarial techniques against external systems without prior written authorization.

---

## Key Capabilities

### 1. Adversarial Attack Engine
- **221 Curated Payloads** across 7 OWASP LLM Top 10 threat categories:
  - Prompt Injection (direct system prompt override)
  - Jailbreaks (persona hijacking, adversarial hypotheticals, DAN variants)
  - System Prompt & Data Extraction
  - Guardrail & Filter Bypasses
  - Tool Abuse & Function Injection
  - Multi-Turn Context Manipulation
  - Obfuscation & Multi-Encoding Vectors (Base64, Rot13, Leetspeak, Unicode)
- **Model-Specific Targeting**: Tailored adversarial suites for OpenAI GPT, Anthropic Claude, Meta Llama, and universal targets.
- **Concurrent Dispatcher**: Adjustable parallelism (1 to 10 concurrent streams) with real-time ETA and rate-limiting resilience.
- **Instant Abort**: Full cooperative cancellation on active network streams.

### 2. Genetic Evolve Engine
- **Iterative Evolutionary Testing**: Genetic algorithm mutator that refines prompts across generations to find bypass paths.
- **Fitness Scoring & Lineage Graph**: Tracks parent-child mutations, fitness scores, and classification outcomes.
- **Export Lineage**: Save full mutation lineages directly to JSON and SARIF 2.1.0 finding formats.

### 3. Attack Chains
- **Multi-Stage Conversational Pipelines**: Orchestrate sequential steps where step responses feed into downstream templates.
- **Dynamic Variable Slots**: Pass extracted secrets, session tokens, or model responses across consecutive turns.

### 4. Zero-Overhead Heuristic Analysis
- **11-Language Behavioral Classifier**: Instant classification of refusals, partial compliance, full jailbreaks, and information leakage without incurring secondary LLM latency or token costs.
- **Leakage & Canary Detection**: Detects system instructions, credit cards, credentials, internal API keys, and environment variables.

### 5. Compliance & Reporting
- **SARIF 2.1.0 Standard**: Direct integration with GitHub Advanced Security and enterprise vulnerability management suites.
- **Executive & Pen-Test Reports**: Detailed 10-section assessment reports with CVSS-aligned risk ratings, category breakdown, and remediation recommendations.
- **Export Formats**: JSON, CSV, and SARIF 2.1.0 with automatic sanitization of sensitive credentials.

### 6. Security Hardening
- **SSRF Transport Protection**: Unconditionally blocks access to cloud instance metadata (`169.254.169.254`). Restricts RFC 1918 private subnets in production unless explicitly authorized.
- **In-Memory Server-Side Key Vault**: Target API keys are never stored in plaintext in the browser's `localStorage`. Credentials reside in an in-memory server vault backed by AES-256-GCM with process-bound entropy.
- **Reverse Proxy Protection**: IP resolution for rate limiting strictly verifies trusted proxy headers.

---

## Quick Start

### Prerequisites
- Node.js 20+ or 22+
- npm 10+

### Installation

```bash
# Clone or navigate to the repository
cd pincer-main

# Install dependencies cleanly
npm ci

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```bash
docker build -t centauri-aegis .
docker run -p 3000:3000 -e AEGIS_ALLOW_PRIVATE_TARGETS=true centauri-aegis
```

---

## Environment Configuration

Configure console settings via `.env` or system environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `AEGIS_AUTH_ENABLED` | Enable password authentication on the console | `false` |
| `AEGIS_USERNAME` | Administrator username for console access | `None` |
| `AEGIS_PASSWORD` | Administrator password for console access | `None` |
| `AEGIS_SESSION_SECRET` | HMAC signing secret for session cookies | Auto-derived from password |
| `AEGIS_KEY_SECRET` | 32-byte secret for server-side key vault | Ephemeral random 256-bit key |
| `AEGIS_ALLOW_PRIVATE_TARGETS` | Permit targeting localhost / private subnets in production | `false` |
| `AEGIS_TRUSTED_PROXY` | Trust `X-Forwarded-For` headers behind reverse proxies | `false` |

*(Legacy `PINCER_*` environment variables remain supported as backward-compatible fallbacks).*

---

## Keyboard Shortcuts

| Shortcut | Action |
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
| `Ctrl+.` | Stop Active Run |
| `Ctrl+/` | View All Keyboard Shortcuts |

---

## Developer Attribution & Upstream Heritage

* **Lead Maintainer & Developer**: `rudrakshp20-hue (@NeelaBillota)`
* **Upstream Project**: Built upon the open-source foundation of **Pincer / RedPincer** by `rustyorb`.
* **License**: MIT License (see [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
