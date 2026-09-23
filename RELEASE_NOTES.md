# Centauri Aegis — Release Notes

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
