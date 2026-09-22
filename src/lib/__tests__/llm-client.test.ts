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
});
