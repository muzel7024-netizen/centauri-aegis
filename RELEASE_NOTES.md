# RedPincer v0.3.0

## What's New

### Bug Fixes
- **Smarter analysis engine** — Reduced false positives with 15 new refusal patterns, explanation-aware classification, and positional analysis (model decodes then refuses = refusal, not breach)
- **Auto-fetch models** — Enter your API key, click Fetch Models, pick from a dropdown (OpenAI, Anthropic, OpenRouter)
- **Edit/delete targets** — Inline pencil and trash buttons on saved targets
- **Stop button** — Cancel running attacks instantly with AbortController
- **Verbose reports** — 10-section professional pen-test quality reports with executive summary, risk matrix, remediation guidance, and appendices

### New Features
- **160 attack payloads** — 40 per category (up from 25), covering prompt injection, jailbreak, data extraction, and guardrail bypass
- **AI payload generation** — Use the target LLM itself to generate novel attack payloads
- **Multi-target comparison** — Run same payloads against 2-4 models side-by-side
- **Adaptive attack engine** — Analyzes weaknesses from a run and suggests targeted follow-ups
- **Vulnerability heatmap** — Visual category x severity matrix with color-coded success rates
- **Regression testing** — Save baselines, re-run later, detect fixes and new vulnerabilities
- **Custom scoring rubrics** — Weighted criteria with letter grades (A+ to F)

### Infrastructure
- Docker support (multi-stage build)
- Standalone Next.js output for containerized deployment

## Quick Start

```bash
git clone https://github.com/rustyorb/pincer.git && cd pincer
npm ci && npm run dev
```

### Docker

```bash
docker build -t redpincer .
docker run -p 3000:3000 redpincer
```

## Full Changelog
https://github.com/rustyorb/pincer/compare/d35746f...v0.3.0
