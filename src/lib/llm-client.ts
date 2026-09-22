import type { LLMRequest, LLMResponse } from "./types";

const DEFAULT_TIMEOUT_MS = 120_000;
const REASONING_TIMEOUT_MS = 300_000;

const REASONING_MODEL_PATTERN = /(\bo1\b|\bo3\b|reason|thinking|deepseek-r1|deepseek-reasoner|grok-4)/i;

function resolveTimeoutMs(model: string): number {
  return REASONING_MODEL_PATTERN.test(model) ? REASONING_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

function isTimeoutLikeError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("aborterror") ||
    lower.includes("aborted") ||
    lower.includes("timeout") ||
    lower.includes("deadline exceeded")
  );
}

/**
 * Send a chat completion request to an LLM provider.
 * Supports OpenAI, Anthropic, OpenRouter, and custom (OpenAI-compatible) endpoints.
 */
export async function sendLLMRequest(req: LLMRequest): Promise<LLMResponse> {
  const start = Date.now();
  const timeoutMs = resolveTimeoutMs(req.model);

  try {
    if (req.provider === "anthropic") {
      return await sendAnthropicRequest(req, start, timeoutMs);
    }
    return await sendOpenAICompatibleRequest(req, start, timeoutMs);
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const message =
      err instanceof Error ? err.message : "Unknown error occurred";

    if (isTimeoutLikeError(message)) {
      return { content: "", error: `Request timed out after ${timeoutMs}ms`, durationMs };
    }

    return { content: "", error: message, durationMs };
  }
}

/**
 * OpenAI-compatible request (works for openai, openrouter, custom providers).
 */
async function sendOpenAICompatibleRequest(
  req: LLMRequest,
  start: number,
  timeoutMs: number
): Promise<LLMResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (req.apiKey.trim()) {
      headers.Authorization = `Bearer ${req.apiKey}`;
    }

    const response = await fetch(req.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        content: "",
        error: `HTTP ${response.status}: ${body || response.statusText}`,
        durationMs,
      };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return { content, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Anthropic Messages API request.
 * Extracts system message from the messages array and sends it as a top-level param.
 */
async function sendAnthropicRequest(
  req: LLMRequest,
  start: number,
  timeoutMs: number
): Promise<LLMResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Separate system messages from the rest
    const systemMessages = req.messages.filter((m) => m.role === "system");
    const nonSystemMessages = req.messages.filter((m) => m.role !== "system");

    const systemText =
      systemMessages.length > 0
        ? systemMessages.map((m) => m.content).join("\n\n")
        : undefined;

    const body: Record<string, unknown> = {
      model: req.model,
      messages: nonSystemMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: 1024,
    };

    if (systemText) {
      body.system = systemText;
    }

    const response = await fetch(req.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      return {
        content: "",
        error: `HTTP ${response.status}: ${responseBody || response.statusText}`,
        durationMs,
      };
    }

    const data = await response.json();
    // Anthropic returns content as an array of content blocks
    const content =
      data?.content
        ?.filter((block: { type: string }) => block.type === "text")
        ?.map((block: { text: string }) => block.text)
        ?.join("") ?? "";

    return { content, durationMs };
  } finally {
    clearTimeout(timer);
  }
}
