# RELEASE_CONFIGURATION.md
# Centauri Aegis v1.1 — Production Environment Configuration

> [!IMPORTANT]
> This file documents every environment variable required to run Centauri Aegis in production.
> Variables marked **REQUIRED** must be set before the application will function correctly in production.
> Never commit actual credentials to this file or to the repository.

---

## Required Variables

### Authentication

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AEGIS_USERNAME` | **REQUIRED** | Login username for the application | `admin` |
| `AEGIS_PASSWORD` | **REQUIRED** | Login password. Also used as session secret fallback and vault key fallback if no dedicated secrets are set. Use a strong password (≥16 chars). | `my-strong-password-here` |

> [!CAUTION]
> If **both** `AEGIS_USERNAME` and `AEGIS_PASSWORD` are absent, authentication is **disabled** and the application is completely open. Always set these in any shared or internet-facing deployment.

### Session Security

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AEGIS_SESSION_SECRET` | Recommended | Dedicated HMAC signing secret for session tokens. If absent, falls back to `AEGIS_PASSWORD`. Must be kept secret and consistent across restarts to avoid invalidating existing sessions. | `random-64-hex-chars` |

> [!TIP]
> Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Key Vault Encryption

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AEGIS_KEY_SECRET` | Recommended | AES-256-GCM key for encrypting API keys in the server-side vault. If absent, falls back to `AEGIS_SESSION_SECRET`, then `AEGIS_PASSWORD`, then a secure ephemeral random key (lost on restart). | `random-64-hex-chars` |

> [!WARNING]
> Without `AEGIS_KEY_SECRET` set to a stable value, users must re-enter API keys after every server restart.

---

## Port and Host Settings

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | Optional | Port the server listens on | `3000` |
| `HOSTNAME` | Optional | Bind hostname | `0.0.0.0` |

---

## Optional Security Settings

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `AEGIS_AUTH_DISABLED` | Optional | Set to `true` to disable authentication even if credentials are configured. **Never use in production.** | `false` |
| `AEGIS_TRUSTED_PROXY` | Optional | Set to `true` if running behind a trusted reverse proxy (nginx, Caddy, etc.). Enables `X-Forwarded-For` and `X-Real-IP` header trust for rate limiting. **Do not enable if direct-to-internet.** | `false` |
| `AEGIS_ALLOW_PRIVATE_TARGETS` | Optional | Set to `true` to allow testing against private/local LLM endpoints (e.g. local Ollama, private vLLM). Disables SSRF protection for RFC-1918 addresses. Only enable in air-gapped or fully trusted environments. | `false` |

---

## Provider Configuration

Centauri Aegis does **not** require provider API keys at server startup. Keys are entered by users in the UI and stored in the encrypted server-side vault. No provider environment variables are needed.

---

## Session Lifecycle

- Sessions expire after **24 hours** from login.
- There is no server-side revocation list (by design — this is a single-user security testing tool).
- Sessions are invalidated implicitly when `AEGIS_SESSION_SECRET` changes or the server restarts (if no stable secret is set).
- API keys in the vault are **lost on restart** unless `AEGIS_KEY_SECRET` is set to a stable value.

---

## Startup Checklist

Before first run, confirm:

- [ ] `AEGIS_USERNAME` is set
- [ ] `AEGIS_PASSWORD` is set (strong, ≥16 chars)
- [ ] `AEGIS_SESSION_SECRET` is set to a stable random value
- [ ] `AEGIS_KEY_SECRET` is set to a stable random value
- [ ] `PORT` is set (or default 3000 is acceptable)
- [ ] `AEGIS_TRUSTED_PROXY` is only set if behind a real proxy
- [ ] `AEGIS_ALLOW_PRIVATE_TARGETS` is only set if intentionally testing local models

---

## Example Production `.env` (never commit to source control)

```bash
# Authentication
AEGIS_USERNAME=your-username
AEGIS_PASSWORD=your-strong-password-here

# Security secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
AEGIS_SESSION_SECRET=<64-hex-chars>
AEGIS_KEY_SECRET=<64-hex-chars>

# Port
PORT=3000

# Trusted proxy (only if behind nginx/Caddy/etc.)
# AEGIS_TRUSTED_PROXY=true

# Private targets (only for local LLM testing)
# AEGIS_ALLOW_PRIVATE_TARGETS=true
```

---

## Deployment Methods

### Option A: Standalone Node.js (`output: standalone`)

The application is pre-configured with `output: "standalone"` in `next.config.ts`.

**Requirements:**
- Node.js ≥ 20 LTS
- `.next/standalone/server.js` produced by `npm run build`

**Start command:**
```bash
NODE_ENV=production node .next/standalone/server.js
```

### Option B: Docker

A multi-stage Alpine `Dockerfile` is included in the repository root.

```bash
docker build -t centauri-aegis:1.1 .
docker run -p 3000:3000 \
  -e AEGIS_USERNAME=admin \
  -e AEGIS_PASSWORD=your-password \
  -e AEGIS_SESSION_SECRET=your-session-secret \
  -e AEGIS_KEY_SECRET=your-key-secret \
  centauri-aegis:1.1
```

### Option C: `npm start` (standard Next.js)

```bash
npm run build
NODE_ENV=production npm start
```

> [!NOTE]
> `npm start` uses `next start` which does not use the standalone output. Use Option A or B for production distribution.

---

## Browser Requirements

Any modern browser with JavaScript enabled:
- Chrome 90+
- Firefox 90+
- Edge 90+
- Safari 15+

No browser extensions required.

---

## Network Requirements

- Outbound HTTPS to LLM providers (OpenAI, Anthropic, xAI, Kimi, Nous, OpenRouter, custom)
- Private/loopback targets blocked by default in production (override with `AEGIS_ALLOW_PRIVATE_TARGETS=true`)

---

*Generated during Centauri Aegis v1.1 Release Candidate Audit — `552b53b`*
