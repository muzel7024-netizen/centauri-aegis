import { NextRequest } from "next/server";
import { resolveKeyFromBody } from "@/lib/resolve-key";
import { validateTargetEndpoint } from "@/lib/endpoint-security";
import {
  clampConcurrency,
  executePayloads,
  resolvePayloads,
} from "@/lib/evolve/runner";
import type { AttackExecutionRequestBody } from "@/lib/evolve/types";

export async function POST(request: NextRequest) {
  try {
    const body: AttackExecutionRequestBody = await request.json();
    const { endpoint, model, provider } = body;
    const resolvedKey = resolveKeyFromBody(body);

    if (!endpoint || !resolvedKey || !model || !provider) {
      const missing: string[] = [];
      if (!endpoint) missing.push("endpoint");
      if (!model) missing.push("model");
      if (!provider) missing.push("provider");
      if (!resolvedKey) missing.push("apiKey");

      const keyHint = !resolvedKey && body.apiKeyId
        ? "Saved API key reference was found, but the key is not loaded in the in-memory vault (likely after restart). Re-enter API key in Target Config."
        : undefined;

      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          missing,
          hint: keyHint,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // SSRF Guard: Validate target endpoint
    const endpointValidation = validateTargetEndpoint(endpoint);
    if (!endpointValidation.allowed) {
      return new Response(
        JSON.stringify({
          error: "Target endpoint rejected by security guard",
          reason: endpointValidation.reason,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Narrow type after guard
    const apiKey: string = resolvedKey;

    const payloads = resolvePayloads(body);

    if (payloads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching payloads found for the given IDs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const concurrency = clampConcurrency(body.concurrency);

    const abortController = new AbortController();
    const forwardAbort = () => {
      abortController.abort();
    };
    request.signal.addEventListener("abort", forwardAbort);

    // Stream results as newline-delimited JSON
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const writeLine = (value: unknown) => {
          if (abortController.signal.aborted || request.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
          } catch {
            abortController.abort();
          }
        };

        // Send meta line first so clients know total payload count
        writeLine({ type: "meta", totalPayloads: payloads.length });

        try {
          await executePayloads(
            payloads,
            { endpoint, apiKey, model, provider },
            concurrency,
            (result) => {
              writeLine(result);
            },
            abortController.signal
          );
        } finally {
          request.signal.removeEventListener("abort", forwardAbort);
          if (!abortController.signal.aborted && !request.signal.aborted) {
            try {
              controller.close();
            } catch {
              // ignore
            }
          }
        }
      },
      cancel() {
        abortController.abort();
        request.signal.removeEventListener("abort", forwardAbort);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
