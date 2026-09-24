import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  initLocalCredentials,
  loadCredentials,
  hasCredentials,
  generateSecurePassword,
  applyCredentialsToEnv,
  findAvailablePort,
  isPortAvailable,
} from "../credential-manager";
import {
  validateCredentials,
  isAuthEnabled,
  createSessionToken,
  validateSessionToken,
} from "../auth";

describe("Credential Manager & One-Click Setup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "centauri-auth-test-"));
    process.env.AEGIS_CONFIG_DIR = tempDir;
    delete process.env.AEGIS_USERNAME;
    delete process.env.AEGIS_PASSWORD;
    delete process.env.AEGIS_SESSION_SECRET;
    delete process.env.AEGIS_KEY_SECRET;
    delete process.env.AEGIS_AUTH_DISABLED;
  });

  afterEach(() => {
    delete process.env.AEGIS_CONFIG_DIR;
    delete process.env.AEGIS_USERNAME;
    delete process.env.AEGIS_PASSWORD;
    delete process.env.AEGIS_SESSION_SECRET;
    delete process.env.AEGIS_KEY_SECRET;
    delete process.env.AEGIS_AUTH_DISABLED;

    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("1. generates first-run configuration with expected structure", () => {
    expect(hasCredentials(tempDir)).toBe(false);

    const result = initLocalCredentials({ customDir: tempDir });
    expect(result.isFirstRun).toBe(true);
    expect(result.isReset).toBe(false);
    expect(result.credentials.username).toBe("admin");
    expect(result.credentials.password).toMatch(/^aegis_[a-f0-9]{24}$/);
    expect(result.credentials.sessionSecret.length).toBe(64);
    expect(result.credentials.keySecret.length).toBe(64);
    expect(fs.existsSync(result.configPath)).toBe(true);
  });

  it("2. generates cryptographically secure passwords with high entropy", () => {
    const passwords = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const pwd = generateSecurePassword();
      expect(pwd).toMatch(/^aegis_[a-f0-9]{24}$/);
      expect(passwords.has(pwd)).toBe(false);
      passwords.add(pwd);
    }
    expect(passwords.size).toBe(50);
  });

  it("3. reuses existing configuration on subsequent loads", () => {
    const firstRun = initLocalCredentials({ customDir: tempDir });
    expect(firstRun.isFirstRun).toBe(true);

    const secondRun = initLocalCredentials({ customDir: tempDir });
    expect(secondRun.isFirstRun).toBe(false);
    expect(secondRun.credentials.username).toBe(firstRun.credentials.username);
    expect(secondRun.credentials.password).toBe(firstRun.credentials.password);
    expect(secondRun.credentials.sessionSecret).toBe(firstRun.credentials.sessionSecret);
  });

  it("4. does not regenerate password on normal subsequent launch", () => {
    const firstRun = initLocalCredentials({ customDir: tempDir });
    const loaded = loadCredentials(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.password).toBe(firstRun.credentials.password);

    const rerun = initLocalCredentials({ customDir: tempDir, reset: false });
    expect(rerun.isFirstRun).toBe(false);
    expect(rerun.credentials.password).toBe(firstRun.credentials.password);
  });

  it("5. ensures authentication remains enabled when credentials applied", () => {
    expect(isAuthEnabled()).toBe(false);

    const { credentials } = initLocalCredentials({ customDir: tempDir });
    applyCredentialsToEnv(credentials);

    expect(isAuthEnabled()).toBe(true);
    expect(process.env.AEGIS_USERNAME).toBe("admin");
    expect(process.env.AEGIS_PASSWORD).toBe(credentials.password);
  });

  it("6. rejects invalid credentials", () => {
    const { credentials } = initLocalCredentials({ customDir: tempDir });
    applyCredentialsToEnv(credentials);

    expect(validateCredentials("admin", "wrong-password")).toBe(false);
    expect(validateCredentials("wrong-user", credentials.password)).toBe(false);
    expect(validateCredentials("", "")).toBe(false);
  });

  it("7. accepts valid credentials", () => {
    const { credentials } = initLocalCredentials({ customDir: tempDir });
    applyCredentialsToEnv(credentials);

    expect(validateCredentials("admin", credentials.password)).toBe(true);
  });

  it("8. session validation works with generated session secret", async () => {
    const { credentials } = initLocalCredentials({ customDir: tempDir });
    applyCredentialsToEnv(credentials);

    const token = await createSessionToken("admin");
    expect(typeof token).toBe("string");

    const session = await validateSessionToken(token);
    expect(session.valid).toBe(true);
    expect(session.username).toBe("admin");

    const forgedToken = `${token.split(".")[0]}.fakeSignature`;
    const forgedResult = await validateSessionToken(forgedToken);
    expect(forgedResult.valid).toBe(false);
  });

  it("9. credential reset invalidates previous authentication state and sessions", async () => {
    const firstRun = initLocalCredentials({ customDir: tempDir });
    applyCredentialsToEnv(firstRun.credentials);

    // Create session token with first session secret
    const initialSessionToken = await createSessionToken("admin");
    const initialCheck = await validateSessionToken(initialSessionToken);
    expect(initialCheck.valid).toBe(true);

    // Perform reset
    const resetRun = initLocalCredentials({ customDir: tempDir, reset: true });
    expect(resetRun.isReset).toBe(true);
    expect(resetRun.credentials.password).not.toBe(firstRun.credentials.password);
    expect(resetRun.credentials.sessionSecret).not.toBe(firstRun.credentials.sessionSecret);

    // Apply new credentials
    applyCredentialsToEnv(resetRun.credentials);

    // Old password should now be invalid
    expect(validateCredentials("admin", firstRun.credentials.password)).toBe(false);
    // New password should be valid
    expect(validateCredentials("admin", resetRun.credentials.password)).toBe(true);

    // Previous session token signed with old secret MUST be rejected
    const invalidatedCheck = await validateSessionToken(initialSessionToken);
    expect(invalidatedCheck.valid).toBe(false);

    // New session token works
    const newSessionToken = await createSessionToken("admin");
    const newCheck = await validateSessionToken(newSessionToken);
    expect(newCheck.valid).toBe(true);
  });

  it("10. detects available ports and provides local fallback", async () => {
    const freePort = await findAvailablePort(3500);
    expect(freePort).toBeGreaterThanOrEqual(3500);
    expect(freePort).toBeLessThan(3550);

    const available = await isPortAvailable(freePort);
    expect(available).toBe(true);
  });
});
