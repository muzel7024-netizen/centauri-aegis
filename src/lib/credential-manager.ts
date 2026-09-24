/**
 * Credential and local configuration manager for Centauri Aegis.
 *
 * Implements secure first-run credential generation, per-user local storage
 * in %LOCALAPPDATA%\CentauriAegis, port availability checks, and recovery reset.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as net from "net";

export interface AegisCredentials {
  username: string;
  password: string;
  sessionSecret: string;
  keySecret: string;
  createdAt: string;
  updatedAt?: string;
  version: string;
}

export interface InitResult {
  credentials: AegisCredentials;
  isFirstRun: boolean;
  isReset: boolean;
  configPath: string;
}

/**
 * Returns the directory used for storing local Centauri Aegis configuration.
 * Priority:
 * 1. AEGIS_CONFIG_DIR env var (allows overriding during tests)
 * 2. %LOCALAPPDATA%\CentauriAegis (standard Windows user data)
 * 3. ~/.centauri-aegis (fallback on non-Windows systems)
 */
export function getConfigDir(): string {
  if (process.env.AEGIS_CONFIG_DIR && process.env.AEGIS_CONFIG_DIR.trim().length > 0) {
    return path.resolve(process.env.AEGIS_CONFIG_DIR.trim());
  }

  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "CentauriAegis");
  }

  // Cross-platform fallback
  return path.join(os.homedir(), ".centauri-aegis");
}

/**
 * Returns the full path to credentials.json.
 */
export function getCredentialsPath(customDir?: string): string {
  const dir = customDir || getConfigDir();
  return path.join(dir, "credentials.json");
}

/**
 * Generates a cryptographically secure random password.
 * Format: 24-character high-entropy hex string (96 bits of cryptographic entropy).
 * Clean, unambiguous characters without batch or shell escaping issues.
 */
export function generateSecurePassword(): string {
  return `aegis_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Checks whether stored credentials already exist on this machine.
 */
export function hasCredentials(customDir?: string): boolean {
  const credPath = getCredentialsPath(customDir);
  return fs.existsSync(credPath);
}

/**
 * Reads and parses existing credentials. Returns null if missing or invalid.
 */
export function loadCredentials(customDir?: string): AegisCredentials | null {
  const credPath = getCredentialsPath(customDir);
  if (!fs.existsSync(credPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(credPath, "utf8");
    const data = JSON.parse(raw);
    if (
      typeof data.username === "string" &&
      typeof data.password === "string" &&
      typeof data.sessionSecret === "string"
    ) {
      return data as AegisCredentials;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves credentials to credentials.json with restricted file permissions.
 */
export function saveCredentials(creds: AegisCredentials, customDir?: string): string {
  const dir = customDir || getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const credPath = path.join(dir, "credentials.json");
  const payload = JSON.stringify(creds, null, 2);
  fs.writeFileSync(credPath, payload, { encoding: "utf8", mode: 0o600 });
  return credPath;
}

/**
 * Initializes or resets local administrator credentials.
 * If credentials exist and reset is false, returns existing credentials without regenerating.
 */
export function initLocalCredentials(options?: {
  reset?: boolean;
  customDir?: string;
}): InitResult {
  const customDir = options?.customDir || getConfigDir();
  const credPath = getCredentialsPath(customDir);
  const exists = hasCredentials(customDir);

  if (exists && !options?.reset) {
    const existing = loadCredentials(customDir);
    if (existing) {
      return {
        credentials: existing,
        isFirstRun: false,
        isReset: false,
        configPath: credPath,
      };
    }
  }

  // First run or explicit reset requested
  const isReset = !!(exists && options?.reset);
  const credentials: AegisCredentials = {
    username: "admin",
    password: generateSecurePassword(),
    sessionSecret: crypto.randomBytes(32).toString("hex"),
    keySecret: crypto.randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
    ...(isReset ? { updatedAt: new Date().toISOString() } : {}),
    version: "1.1.0",
  };

  saveCredentials(credentials, customDir);

  return {
    credentials,
    isFirstRun: !exists,
    isReset,
    configPath: credPath,
  };
}

/**
 * Checks if a TCP port is currently available on the specified host.
 */
export function isPortAvailable(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Finds the first available port starting from preferredPort up to preferredPort + maxAttempts.
 * Defaults strictly to host '127.0.0.1' to prevent LAN exposure.
 */
export async function findAvailablePort(
  preferredPort = 3000,
  host = "127.0.0.1",
  maxAttempts = 50
): Promise<number> {
  for (let port = preferredPort; port < preferredPort + maxAttempts; port++) {
    const available = await isPortAvailable(port, host);
    if (available) {
      return port;
    }
  }
  throw new Error(
    `No available local port found on ${host} between ${preferredPort} and ${
      preferredPort + maxAttempts
    }.`
  );
}

/**
 * Applies credentials to the process environment.
 * Sets AEGIS_USERNAME, AEGIS_PASSWORD, AEGIS_SESSION_SECRET, and AEGIS_KEY_SECRET.
 */
export function applyCredentialsToEnv(creds: AegisCredentials): void {
  process.env.AEGIS_USERNAME = creds.username;
  process.env.AEGIS_PASSWORD = creds.password;
  process.env.AEGIS_SESSION_SECRET = creds.sessionSecret;
  process.env.AEGIS_KEY_SECRET = creds.keySecret;
}
