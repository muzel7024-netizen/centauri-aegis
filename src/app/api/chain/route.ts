import { NextRequest } from "next/server";
import { sendLLMRequest } from "@/lib/llm-client";
import type { TargetConfig } from "@/lib/types";
import type { AttackChain, ChainStep, ChainStepResult } from "@/lib/chains";
import { resolveKeyFromBody } from "@/lib/resolve-key";
import { transformResponse, resolveTemplate } from "@/lib/chains";
import { validateTargetEndpoint } from "@/lib/endpoint-security";

interface ChainRequestBody {
  endpoint: string;
  apiKey?: string;
  apiKeyId?: string;
  model: string;
  provider: TargetConfig["provider"];
  chain: AttackChain;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body: ChainRequestBody = await request.json();
    const { endpoint, model, provider, chain } = body;
    const apiKey = resolveKeyFromBody(body);

    if (!endpoint || !apiKey || !model || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing required target fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
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

    if (!chain?.steps?.length) {
      return new Response(
        JSON.stringify({ error: "Chain must have at least one step" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Sort steps by order
    const sortedSteps = [...chain.steps].sort((a, b) => a.order - b.order);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const conversationHistory: { role: "system" | "user" | "assistant"; content: string }[] = [];
        const stepResults = new Map<string, string>(); // stepId -> transformed response
        let previousResponse: string | undefined;
        const stepResultsList: ChainStepResult[] = [];
        const startTime = Date.now();

        for (const step of sortedSteps) {
          try {
            // Optional delay between steps
            if (step.delayMs && step.delayMs > 0) {
              await sleep(step.delayMs);
            }

            // Resolve template variables in the prompt
            const resolvedPrompt = resolveTemplate(
              step.prompt,
              stepResults,
              previousResponse,
            );

            // Resolve system prompt if present
            const resolvedSystemPrompt = step.systemPrompt
              ? resolveTemplate(step.systemPrompt, stepResults, previousResponse)
              : undefined;

            // Build messages: include conversation history + this step's prompt
            const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

            // Add system prompt if this step has one (only for first message or override)
            if (resolvedSystemPrompt) {
              messages.push({ role: "system", content: resolvedSystemPrompt });
            }

            // Add conversation history
            messages.push(...conversationHistory);

            // Add this step's prompt
            messages.push({ role: "user", content: resolvedPrompt });

            // Send to LLM
            const llmResult = await sendLLMRequest({
              endpoint,
              apiKey,
              model,
              provider,
              messages,
            });

            const responseContent = llmResult.content || "";
            const transformed = transformResponse(
              responseContent,
              step.transformResponse,
            );

            // Store for future steps
            stepResults.set(step.id, transformed);
            previousResponse = transformed;

            // Grow the conversation history
            conversationHistory.push({ role: "user", content: resolvedPrompt });
            conversationHistory.push({ role: "assistant", content: responseContent });

            const stepResult: ChainStepResult = {
              stepId: step.id,
              stepName: step.name,
              order: step.order,
              prompt: resolvedPrompt,
              response: responseContent,
              durationMs: llmResult.durationMs,
              status: llmResult.error ? "error" : "success",
              error: llmResult.error,
            };

            stepResultsList.push(stepResult);

            // Stream as NDJSON
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "step_result", ...stepResult }) + "\n",
              ),
            );
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error";

            const stepResult: ChainStepResult = {
              stepId: step.id,
              stepName: step.name,
              order: step.order,
              prompt: step.prompt,
              response: "",
              durationMs: 0,
              status: "error",
              error: errorMessage,
            };

            stepResultsList.push(stepResult);

            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "step_result", ...stepResult }) + "\n",
              ),
            );

            // On error, stop the chain
            break;
          }
        }

        // Stream summary
        const successCount = stepResultsList.filter(
          (r) => r.status === "success",
        ).length;
        const hasErrors = stepResultsList.some((r) => r.status === "error");

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "summary",
              chainId: chain.id,
              chainName: chain.name,
              totalSteps: sortedSteps.length,
              completedSteps: stepResultsList.length,
              successfulSteps: successCount,
              overallSuccess: successCount === sortedSteps.length && !hasErrors,
              startTime,
              endTime: Date.now(),
            }) + "\n",
          ),
        );

        controller.close();
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
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
