import { NextRequest } from "next/server";
import { resolveKeyFromBody } from "@/lib/resolve-key";
import { validateTargetEndpoint } from "@/lib/endpoint-security";
import {
  buildLineageExports,
  buildLineageNodes,
  buildNextGenerationAdvanced,
  clampConcurrency,
  clampGenerationCount,
  clampMutationRate,
  clampTopK,
  executePayloads,
  resolvePayloads,
  scoreGeneration,
  summarizeGeneration,
} from "@/lib/evolve/runner";
import type {
  EvolveLineageNode,
  EvolveLineageRecord,
  EvolveMetaEvent,
  EvolveMutationMode,
  EvolveRequestBody,
} from "@/lib/evolve/types";

export async function POST(request: NextRequest) {
  try {
    const body: EvolveRequestBody = await request.json();
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

    const apiKey: string = resolvedKey;
    const initialPayloads = resolvePayloads(body);

    if (initialPayloads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching payloads found for the given IDs" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const concurrency = clampConcurrency(body.concurrency);
    const totalGenerations = clampGenerationCount(body.generations);
    const mutationRate = clampMutationRate(body.mutationRate);
    const topK = clampTopK(body.topK, initialPayloads.length);
    const mutationMode: EvolveMutationMode =
      body.mutationMode === "llm" ? "llm" : "deterministic";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const writeLine = (value: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        };

        const meta: EvolveMetaEvent = {
          type: "meta",
          totalGenerations,
          initialPayloadCount: initialPayloads.length,
          totalPayloads: initialPayloads.length,
          concurrency,
          topK,
          mutationRate,
        };

        writeLine(meta);

        let population = initialPayloads;
        const lineageRecords: EvolveLineageRecord[] = [];
        const lineageNodes: EvolveLineageNode[] = [];

        for (let generation = 0; generation < totalGenerations; generation += 1) {
          const totalPayloadsForGeneration = population.length;
          let completedForGeneration = 0;

          writeLine({
            type: "generation_progress",
            generation,
            totalGenerations,
            completed: completedForGeneration,
            total: totalPayloadsForGeneration,
          });

          const results = await executePayloads(
            population,
            { endpoint, apiKey, model, provider },
            concurrency,
            () => {
              completedForGeneration += 1;
              writeLine({
                type: "generation_progress",
                generation,
                totalGenerations,
                completed: completedForGeneration,
                total: totalPayloadsForGeneration,
              });
            }
          );
          const scoredPayloads = scoreGeneration(population, results);
          lineageNodes.push(...buildLineageNodes(generation, scoredPayloads));

          const nextPopulationSize =
            generation < totalGenerations - 1 ? population.length : null;

          writeLine(
            summarizeGeneration(
              scoredPayloads,
              generation,
              nextPopulationSize,
              clampTopK(topK, scoredPayloads.length)
            )
          );

          if (generation < totalGenerations - 1) {
            const next = await buildNextGenerationAdvanced(
              scoredPayloads,
              generation,
              population.length,
              topK,
              mutationRate,
              mutationMode,
              mutationMode === "llm" ? { endpoint, apiKey, model, provider } : undefined
            );
            population = next.payloads;
            lineageRecords.push(...next.lineage);
          }
        }

        const generatedAt = new Date().toISOString();
        const { jsonExport, sarifExport } = buildLineageExports(lineageRecords, lineageNodes);
        writeLine({
          type: "lineage_export",
          generatedAt,
          lineage: lineageRecords,
          nodes: lineageNodes,
          finalPopulation: population,
          jsonExport,
          sarifExport,
        });

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
