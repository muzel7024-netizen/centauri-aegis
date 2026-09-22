import { NextRequest, NextResponse } from "next/server";
import type { TargetConfig } from "@/lib/types";
import { resolveKeyFromBody } from "@/lib/resolve-key";
import { validateTargetEndpoint } from "@/lib/endpoint-security";

const ANTHROPIC_MODELS = [
  "claude-opus-4-20250918",
  "claude-sonnet-4-20250514",
  "claude-haiku-4-20250414",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      endpoint: string;
      apiKey?: string;
      apiKeyId?: string;
      provider: TargetConfig["provider"];
    };
    const { endpoint, provider } = body;
    const apiKey = resolveKeyFromBody(body);

    if (!apiKey || !provider) {
      return NextResponse.json(
        { models: [], error: "Missing required fields: apiKey, provider" },
        { status: 400 }
      );
    }

    let models: string[] = [];

    const resolveModelsUrl = (rawEndpoint: string | undefined, fallback: string) => {
      if (!rawEndpoint?.trim()) {
        return fallback;
      }
      const endpoint = rawEndpoint.trim();
      if (endpoint.endsWith("/models")) {
        return endpoint;
      }
      if (endpoint.includes("/chat/completions")) {
        return endpoint.replace(/\/chat\/completions$/, "/models");
      }
      if (endpoint.includes("/completions")) {
        return endpoint.replace(/\/completions$/, "/models");
      }
      if (endpoint.endsWith("/v1")) {
        return `${endpoint}/models`;
      }
      return fallback;
    };

    const fetchModelIds = async (modelsUrl: string, providerLabel: string) => {
      const endpointValidation = validateTargetEndpoint(modelsUrl);
      if (!endpointValidation.allowed) {
        return NextResponse.json(
          { models: [], error: `Target rejected by security guard: ${endpointValidation.reason}` },
          { status: 403 }
        );
      }

      const res = await fetch(modelsUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { models: [], error: `${providerLabel} API error: ${res.status} ${errText}` },
          { status: 200 }
        );
      }
      const data = await res.json();
      return (data.data as { id: string }[]).map((m) => m.id);
    };

    if (provider === "anthropic") {
      models = ANTHROPIC_MODELS;
    } else if (provider === "openai") {
      const fetched = await fetchModelIds(
        resolveModelsUrl(endpoint, "https://api.openai.com/v1/models"),
        "OpenAI"
      );
      if (fetched instanceof NextResponse) return fetched;
      models = fetched.filter(
        (id) =>
          id.includes("gpt") ||
          id.startsWith("o1") ||
          id.startsWith("o3") ||
          id.startsWith("chatgpt")
      );
    } else if (provider === "openrouter") {
      const fetched = await fetchModelIds(
        resolveModelsUrl(endpoint, "https://openrouter.ai/api/v1/models"),
        "OpenRouter"
      );
      if (fetched instanceof NextResponse) return fetched;
      models = fetched;
    } else if (provider === "xai") {
      const fetched = await fetchModelIds(
        resolveModelsUrl(endpoint, "https://api.x.ai/v1/models"),
        "xAI"
      );
      if (fetched instanceof NextResponse) return fetched;
      models = fetched;
    } else if (provider === "kimi") {
      const fetched = await fetchModelIds(
        resolveModelsUrl(endpoint, "https://api.kimi.com/coding/v1/models"),
        "Kimi"
      );
      if (fetched instanceof NextResponse) return fetched;
      models = fetched;
    } else if (provider === "nous") {
      const fetched = await fetchModelIds(
        resolveModelsUrl(endpoint, "https://inference-api.nousresearch.com/v1/models"),
        "Nous"
      );
      if (fetched instanceof NextResponse) return fetched;
      models = fetched;
    } else {
      // Custom provider - return empty
      return NextResponse.json({ models: [] });
    }

    models.sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ models });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { models: [], error: message },
      { status: 500 }
    );
  }
}
