import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendLLMRequest } from "../llm-client";
import type { LLMRequest } from "../types";

describe("llm-client", () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends OpenAI-compatible requests and parses content", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "safe response" } }],
        }),
        { status: 200 }
      )
    );

    const req: LLMRequest = {
      endpoint: "https://api.example.com/v1/chat/completions",
      apiKey: "test-key",
      model: "gpt-4o-mini",
      provider: "openai",
      messages: [{ role: "user", content: "hello" }],
    };

    const result = await sendLLMRequest(req);

    expect(result.error).toBeUndefined();
    expect(result.content).toBe("safe response");
    expect(result.durationMs).toBeTypeOf("number");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer test-key",
    });

    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: "hello" }],
    });
  });

  it("returns HTTP error details for failed OpenAI-compatible responses", async () => {
    mockFetch.mockResolvedValueOnce(new Response("invalid key", { status: 401 }));

    const result = await sendLLMRequest({
      endpoint: "https://api.example.com/v1/chat/completions",
      apiKey: "bad-key",
      model: "gpt-4o-mini",
      provider: "custom",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.content).toBe("");
    expect(result.error).toContain("HTTP 401");
    expect(result.error).toContain("invalid key");
  });

  it("omits Authorization header for custom provider when apiKey is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200 }
      )
    );

    await sendLLMRequest({
      endpoint: "http://localhost:1234/v1/chat/completions",
      apiKey: "",
      model: "local-model",
      provider: "custom",
      messages: [{ role: "user", content: "ping" }],
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(options.headers).not.toHaveProperty("Authorization");
  });

  it("formats Anthropic payloads and combines text blocks", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "Part 1 " },
            { type: "image", source: "ignored" },
            { type: "text", text: "Part 2" },
          ],
        }),
        { status: 200 }
      )
    );

    const result = await sendLLMRequest({
      endpoint: "https://api.anthropic.com/v1/messages",
      apiKey: "anthropic-key",
      model: "claude-sonnet",
      provider: "anthropic",
      messages: [
        { role: "system", content: "System A" },
        { role: "system", content: "System B" },
        { role: "user", content: "Hi" },
      ],
    });

    expect(result.error).toBeUndefined();
    expect(result.content).toBe("Part 1 Part 2");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-api-key": "anthropic-key",
      "anthropic-version": "2023-06-01",
    });

    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      model: "claude-sonnet",
      max_tokens: 1024,
      system: "System A\n\nSystem B",
      messages: [{ role: "user", content: "Hi" }],
    });
  });

  it("maps abort-style errors to timeout responses", async () => {
    mockFetch.mockRejectedValueOnce(new Error("AbortError: request aborted"));

    const result = await sendLLMRequest({
      endpoint: "https://api.example.com/v1/chat/completions",
      apiKey: "test-key",
      model: "gpt-4o-mini",
      provider: "openrouter",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result.content).toBe("");
    expect(result.error).toBe("Request timed out after 120000ms");
  });

  it("uses longer timeout windows for reasoning models", async () => {
    mockFetch.mockRejectedValueOnce(new Error("The operation was aborted"));

    const result = await sendLLMRequest({
      endpoint: "https://api.example.com/v1/chat/completions",
      apiKey: "test-key",
      model: "o3",
      provider: "openai",
      messages: [{ role: "user", content: "think" }],
    });

    expect(result.content).toBe("");
    expect(result.error).toBe("Request timed out after 300000ms");
  });

  describe("SSRF policy enforcement", () => {
    it("unconditionally blocks cloud metadata endpoint (169.254.169.254) without making network request", async () => {
      const result = await sendLLMRequest({
        endpoint: "http://169.254.169.254/latest/meta-data",
        apiKey: "test-key",
        model: "gpt-4o-mini",
        provider: "openai",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(result.content).toBe("");
      expect(result.error).toContain("Endpoint rejected by security policy");
      expect(result.error).toContain("169.254");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks malformed endpoint URL without making network request", async () => {
      const result = await sendLLMRequest({
        endpoint: "not-a-valid-url",
        apiKey: "test-key",
        model: "gpt-4o-mini",
        provider: "openai",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(result.content).toBe("");
      expect(result.error).toContain("Malformed endpoint URL");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks unsupported protocol without making network request", async () => {
      const result = await sendLLMRequest({
        endpoint: "ftp://example.com/api",
        apiKey: "test-key",
        model: "gpt-4o-mini",
        provider: "openai",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(result.content).toBe("");
      expect(result.error).toContain("Unsupported protocol");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("blocks private IP and loopback in production mode when AEGIS_ALLOW_PRIVATE_TARGETS is not set", async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevAllow = process.env.AEGIS_ALLOW_PRIVATE_TARGETS;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.AEGIS_ALLOW_PRIVATE_TARGETS;

        const loopbackResult = await sendLLMRequest({
          endpoint: "http://127.0.0.1:8000/v1/chat/completions",
          apiKey: "test-key",
          model: "gpt-4o-mini",
          provider: "openai",
          messages: [{ role: "user", content: "hello" }],
        });
        expect(loopbackResult.error).toContain("resolves to a private or loopback address");
        expect(mockFetch).not.toHaveBeenCalled();

        const privateResult = await sendLLMRequest({
          endpoint: "http://10.0.0.5:8000/v1/chat/completions",
          apiKey: "test-key",
          model: "gpt-4o-mini",
          provider: "openai",
          messages: [{ role: "user", content: "hello" }],
        });
        expect(privateResult.error).toContain("resolves to a private or loopback address");
        expect(mockFetch).not.toHaveBeenCalled();
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
        if (prevAllow !== undefined) {
          process.env.AEGIS_ALLOW_PRIVATE_TARGETS = prevAllow;
        } else {
          delete process.env.AEGIS_ALLOW_PRIVATE_TARGETS;
        }
      }
    });

    it("permits private targets in production mode when AEGIS_ALLOW_PRIVATE_TARGETS=true", async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevAllow = process.env.AEGIS_ALLOW_PRIVATE_TARGETS;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        process.env.AEGIS_ALLOW_PRIVATE_TARGETS = "true";

        mockFetch.mockResolvedValueOnce(
          new Response(
            JSON.stringify({ choices: [{ message: { content: "local ok" } }] }),
            { status: 200 }
          )
        );

        const result = await sendLLMRequest({
          endpoint: "http://127.0.0.1:11434/v1/chat/completions",
          apiKey: "test-key",
          model: "llama3",
          provider: "openai",
          messages: [{ role: "user", content: "hello" }],
        });

        expect(result.content).toBe("local ok");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
        if (prevAllow !== undefined) {
          process.env.AEGIS_ALLOW_PRIVATE_TARGETS = prevAllow;
        } else {
          delete process.env.AEGIS_ALLOW_PRIVATE_TARGETS;
        }
      }
    });
  });

  describe("redirect hardening", () => {
    it("uses redirect: manual and blocks redirect to cloud metadata destination", async () => {
      // Step 1: Initial public endpoint returns a 302 redirect pointing to AWS/GCP metadata service
      const redirectResponse = new Response(null, {
        status: 302,
        headers: {
          Location: "http://169.254.169.254/latest/meta-data",
        },
      });
      mockFetch.mockResolvedValueOnce(redirectResponse);

      const result = await sendLLMRequest({
        endpoint: "https://api.example.com/v1/chat/completions",
        apiKey: "test-key",
        model: "gpt-4o-mini",
        provider: "openai",
        messages: [{ role: "user", content: "hello" }],
      });

      // Verification: The request fails with security policy rejection and metadata destination was NEVER called
      expect(result.content).toBe("");
      expect(result.error).toContain("Redirect to \"http://169.254.169.254/latest/meta-data\" blocked by security policy");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify that initial call used redirect: manual
      const [, firstCallInit] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(firstCallInit.redirect).toBe("manual");
    });

    it("safely follows redirect to a valid public endpoint", async () => {
      // Step 1: Initial call returns 301 to another valid public HTTPS endpoint
      const redirectResponse = new Response(null, {
        status: 301,
        headers: {
          Location: "https://api-backup.example.com/v1/chat/completions",
        },
      });
      // Step 2: Second call returns 200 OK
      const successResponse = new Response(
        JSON.stringify({
          choices: [{ message: { content: "redirect succeeded" } }],
        }),
        { status: 200 }
      );

      mockFetch.mockResolvedValueOnce(redirectResponse);
      mockFetch.mockResolvedValueOnce(successResponse);

      const result = await sendLLMRequest({
        endpoint: "https://api.example.com/v1/chat/completions",
        apiKey: "test-key",
        model: "gpt-4o-mini",
        provider: "openai",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(result.content).toBe("redirect succeeded");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toBe("https://api-backup.example.com/v1/chat/completions");
    });
  });
});
