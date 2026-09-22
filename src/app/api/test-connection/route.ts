import { NextRequest, NextResponse } from "next/server";
import { sendLLMRequest } from "@/lib/llm-client";
import type { TargetConfig } from "@/lib/types";
import { resolveKeyFromBody } from "@/lib/resolve-key";
import { validateTargetEndpoint } from "@/lib/endpoint-security";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      endpoint: string;
      apiKey?: string;
      apiKeyId?: string;
      model: string;
      provider: TargetConfig["provider"];
    };
    const { endpoint, model, provider } = body;
    const apiKey = resolveKeyFromBody(body);

    if (!endpoint || !model || !provider || (provider !== "custom" && !apiKey)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: endpoint, apiKey, model, provider" },
        { status: 400 }
      );
    }

    // SSRF Guard: Validate target endpoint
    const endpointValidation = validateTargetEndpoint(endpoint);
    if (!endpointValidation.allowed) {
      return NextResponse.json(
        { success: false, error: endpointValidation.reason },
        { status: 403 }
      );
    }

    const result = await sendLLMRequest({
      endpoint,
      apiKey: apiKey ?? "",
      model,
      provider,
      messages: [
        { role: "user", content: "Hello, respond with OK" },
      ],
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Connected successfully",
      latencyMs: result.durationMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
