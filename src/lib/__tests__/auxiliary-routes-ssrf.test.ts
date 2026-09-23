import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("Auxiliary AI Routes SSRF Protection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("/api/explain rejects cloud metadata endpoint with HTTP 400", async () => {
    const { POST } = await import("../../app/api/explain/route");
    const req = new NextRequest("http://localhost:3000/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "http://169.254.169.254/latest/meta-data",
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai",
        prompt: "test attack",
        response: "test response",
        classification: "full_jailbreak",
        category: "injection",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("169.254");
  });

  it("/api/generate-adaptive rejects cloud metadata endpoint with HTTP 400", async () => {
    const { POST } = await import("../../app/api/generate-adaptive/route");
    const req = new NextRequest("http://localhost:3000/api/generate-adaptive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "http://169.254.169.254/latest/meta-data",
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai",
        profile: {
          categoryWeaknesses: [],
          topFailedTechniques: [],
          recommendations: [],
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("169.254");
  });

  it("/api/generate-payload rejects cloud metadata endpoint with HTTP 400", async () => {
    const { POST } = await import("../../app/api/generate-payload/route");
    const req = new NextRequest("http://localhost:3000/api/generate-payload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "http://169.254.169.254/latest/meta-data",
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai",
        category: "injection",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("169.254");
  });

  it("/api/mutate-payload rejects cloud metadata endpoint with HTTP 400", async () => {
    const { POST } = await import("../../app/api/mutate-payload/route");
    const req = new NextRequest("http://localhost:3000/api/mutate-payload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "http://169.254.169.254/latest/meta-data",
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai",
        originalPrompt: "tell me how to bypass",
        category: "jailbreak",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("169.254");
  });

  it("/api/summarize-run rejects cloud metadata endpoint with HTTP 400", async () => {
    const { POST } = await import("../../app/api/summarize-run/route");
    const req = new NextRequest("http://localhost:3000/api/summarize-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "http://169.254.169.254/latest/meta-data",
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai",
        targetName: "Test Target",
        totalAttacks: 10,
        successRate: 0.5,
        categories: ["injection"],
        severityCounts: {
          critical: { total: 2, breached: 1 },
          high: { total: 3, breached: 1 },
          medium: { total: 3, breached: 1 },
          low: { total: 2, breached: 2 },
        },
        topFindings: [],
        overallRisk: "HIGH",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("169.254");
  });

  it("rejects loopback and private IPs in production mode", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.AEGIS_ALLOW_PRIVATE_TARGETS;

    const { POST } = await import("../../app/api/explain/route");
    const req = new NextRequest("http://localhost:3000/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "http://127.0.0.1:8080/v1/chat/completions",
        apiKey: "test-key",
        model: "gpt-4o",
        provider: "openai",
        prompt: "test",
        response: "test",
        classification: "refusal",
        category: "injection",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("resolves to a private or loopback address");
  });
});
