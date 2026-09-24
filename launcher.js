/**
 * Centauri Aegis v1.1.0 — Production Launcher & Credential Bridge
 *
 * Implements:
 * 1. Automatic first-run administrator credential generation
 * 2. Secure local storage in %LOCALAPPDATA%\CentauriAegis\credentials.json
 * 3. Safe localhost port allocation (fallback if 3000 is occupied)
 * 4. Automatic browser launch when the Next.js server is ready
 * 5. Password reset via `--reset` flag
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const net = require("net");
const http = require("http");
const { exec } = require("child_process");
const readline = require("readline");

// ── Directory and Paths ───────────────────────────────────────────────────

function getConfigDir() {
  if (process.env.AEGIS_CONFIG_DIR && process.env.AEGIS_CONFIG_DIR.trim().length > 0) {
    return path.resolve(process.env.AEGIS_CONFIG_DIR.trim());
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "CentauriAegis");
  }
  return path.join(os.homedir(), ".centauri-aegis");
}

function getCredentialsPath() {
  return path.join(getConfigDir(), "credentials.json");
}

function generateSecurePassword() {
  return `aegis_${crypto.randomBytes(12).toString("hex")}`;
}

function loadCredentials() {
  const file = getCredentialsPath();
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (data.username && data.password && data.sessionSecret) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function saveCredentials(creds) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const file = path.join(dir, "credentials.json");
  fs.writeFileSync(file, JSON.stringify(creds, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  return file;
}

function initCredentials(isReset = false) {
  const existing = loadCredentials();
  if (existing && !isReset) {
    return { credentials: existing, isFirstRun: false, isReset: false };
  }

  const credentials = {
    username: "admin",
    password: generateSecurePassword(),
    sessionSecret: crypto.randomBytes(32).toString("hex"),
    keySecret: crypto.randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
    ...(isReset ? { updatedAt: new Date().toISOString() } : {}),
    version: "1.1.0",
  };

  saveCredentials(credentials);
  return {
    credentials,
    isFirstRun: !existing,
    isReset,
  };
}

// ── Port Availability ─────────────────────────────────────────────────────

function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(preferredPort = 3000, host = "127.0.0.1", maxAttempts = 50) {
  for (let port = preferredPort; port < preferredPort + maxAttempts; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error(`No available local port found on ${host} between ${preferredPort} and ${preferredPort + maxAttempts}`);
}

// ── User Prompt Helper ────────────────────────────────────────────────────

function promptEnter(message) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

// ── Background Browser Opener ─────────────────────────────────────────────

function openBrowserWhenReady(url, maxWaitMs = 25000) {
  const startTime = Date.now();
  const parsed = new URL(url);

  const checkInterval = setInterval(() => {
    if (Date.now() - startTime > maxWaitMs) {
      clearInterval(checkInterval);
      return;
    }

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: "/login",
        method: "GET",
        timeout: 1000,
      },
      (res) => {
        clearInterval(checkInterval);
        // Server responded — open browser
        const cmd = process.platform === "win32" ? `start "" "${url}"` : `open "${url}"`;
        exec(cmd, (err) => {
          if (err) {
            console.log(`[*] Please open your browser to: ${url}`);
          }
        });
      }
    );

    req.on("error", () => {
      // Server not ready yet; retry next tick
    });
    req.on("timeout", () => {
      req.destroy();
    });
    req.end();
  }, 400);

  // Unref interval so it does not keep process alive
  checkInterval.unref();
}

// ── Main Entrypoint ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isReset = args.includes("--reset");

  // Handle password reset flow
  if (isReset) {
    console.log("============================================================================");
    console.log("  Centauri Aegis — Reset Administrator Credentials");
    console.log("============================================================================");
    console.log("");

    const { credentials } = initCredentials(true);

    console.log("[*] New administrator credentials generated successfully:");
    console.log("");
    console.log(`    Username:         ${credentials.username}`);
    console.log(`    New password:     ${credentials.password}`);
    console.log("");
    console.log("[!] All previous sessions and encryption keys have been invalidated.");
    console.log(`[!] Configuration saved to: ${getCredentialsPath()}`);
    console.log("============================================================================");
    console.log("");
    process.exit(0);
  }

  console.log("============================================================================");
  console.log("  Centauri Aegis v1.1.0 — AI Security Testing & Research Platform");
  console.log("============================================================================");
  console.log("");

  // Initialize or load credentials
  const init = initCredentials(false);
  const creds = init.credentials;

  if (init.isFirstRun) {
    console.log("[*] First-run setup detected.");
    console.log("[*] Local administrator credentials have been generated:");
    console.log("");
    console.log(`    Username:         ${creds.username}`);
    console.log(`    Initial password: ${creds.password}`);
    console.log("");
    console.log("[!] Save this password securely. It will NOT be shown again.");
    console.log(`[!] Configuration saved to: ${getCredentialsPath()}`);
    console.log("");
    console.log("============================================================================");
    console.log("");
    await promptEnter("Press Enter to continue launching Centauri Aegis... ");
    console.log("");
  } else {
    console.log("[*] Authentication: ENABLED");
    console.log(`[*] Loaded local configuration for user: ${creds.username}`);
  }

  // Apply credentials directly into memory (not exposed in command-line arguments)
  process.env.AEGIS_USERNAME = creds.username;
  process.env.AEGIS_PASSWORD = creds.password;
  process.env.AEGIS_SESSION_SECRET = creds.sessionSecret;
  process.env.AEGIS_KEY_SECRET = creds.keySecret;
  process.env.NODE_ENV = "production";
  process.env.HOSTNAME = "127.0.0.1";

  // Select safe port
  const preferredPort = parseInt(process.env.PORT, 10) || 3000;
  const port = await findAvailablePort(preferredPort, "127.0.0.1");
  if (port !== preferredPort) {
    console.log(`[!] Preferred port ${preferredPort} is in use. Using fallback port ${port}.`);
  }
  process.env.PORT = String(port);

  const localUrl = `http://127.0.0.1:${port}`;
  console.log(`[*] Local URL:    ${localUrl}`);
  console.log("[*] Bind address: 127.0.0.1 (LAN access is strictly disabled)");
  console.log("[*] Starting production server...");
  console.log("[*] Press Ctrl+C in this window to stop the server cleanly.");
  console.log("");

  // Automatically trigger browser once ready (unless disabled)
  const shouldOpenBrowser = process.env.OPEN_BROWSER !== "0" && !args.includes("--no-browser");
  if (shouldOpenBrowser) {
    openBrowserWhenReady(localUrl);
  }

  // Load and start Next.js standalone server
  const serverPath = path.resolve(__dirname, "server.js");
  if (!fs.existsSync(serverPath)) {
    console.error(`[ERROR] server.js not found at ${serverPath}`);
    process.exit(1);
  }

  require(serverPath);
}

main().catch((err) => {
  console.error("[ERROR] Failed to start Centauri Aegis:", err);
  process.exit(1);
});
