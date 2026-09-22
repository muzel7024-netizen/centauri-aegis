import type {
  AttackCategory,
  AttackPayload,
  AttackResult,
  TargetConfig,
} from "@/lib/types";

export interface PayloadSelectionInput {
  categories?: AttackCategory[];
  payloadIds?: string[];
  rawPayloads?: AttackPayload[];
}

export interface AttackExecutionRequestBody extends PayloadSelectionInput {
  endpoint: string;
  apiKey?: string;
  apiKeyId?: string;
  model: string;
  provider: TargetConfig["provider"];
  concurrency?: number;
}

export interface ExecutionConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  provider: TargetConfig["provider"];
}

export type EvolveMutationMode = "deterministic" | "llm";

export interface EvolveRequestBody extends AttackExecutionRequestBody {
  generations?: number;
  topK?: number;
  mutationRate?: number;
  mutationMode?: EvolveMutationMode;
}

export interface ScoredPayload {
  payload: AttackPayload;
  result: AttackResult;
  successRate: number;
  avgSeverityNorm: number;
  novelty: number;
  fitness: number;
}

export interface EvolveRankedPayloadSummary {
  payloadId: string;
  payloadName: string;
  prompt: string;
  fitness: number;
  success: boolean;
  status: AttackResult["status"];
  classification: AttackResult["analysis"]["classification"];
  severityNorm: number;
  novelty: number;
}

export interface EvolveMetaEvent {
  type: "meta";
  totalGenerations: number;
  initialPayloadCount: number;
  totalPayloads: number;
  concurrency: number;
  topK: number;
  mutationRate: number;
}

export interface EvolveGenerationSummaryEvent {
  type: "generation_summary";
  generation: number;
  totalPayloads: number;
  successCount: number;
  successRate: number;
  avgSeverityNorm: number;
  avgNovelty: number;
  avgFitness: number;
  topPayloads: EvolveRankedPayloadSummary[];
  nextPopulationSize: number | null;
}

export interface EvolveGenerationProgressEvent {
  type: "generation_progress";
  generation: number;
  totalGenerations: number;
  completed: number;
  total: number;
}

export interface EvolveLineageRecord {
  childId: string;
  childName: string;
  generation: number;
  parentIds: string[];
  parentNames: string[];
  mutationMode: EvolveMutationMode;
  technique: string;
  fallbackUsed: boolean;
}

export interface EvolveLineageNode {
  payloadId: string;
  payloadName: string;
  prompt: string;
  generation: number;
  fitness: number;
  success: boolean;
  classification: AttackResult["analysis"]["classification"];
  severityNorm: number;
}

export interface EvolveLineageExportEvent {
  type: "lineage_export";
  generatedAt: string;
  lineage: EvolveLineageRecord[];
  nodes: EvolveLineageNode[];
  finalPopulation: AttackPayload[];
  jsonExport: {
    schemaVersion: string;
    tool: string;
    generatedAt: string;
    lineage: EvolveLineageRecord[];
    nodes: EvolveLineageNode[];
  };
  sarifExport: {
    version: string;
    $schema: string;
    runs: Array<{
      tool: {
        driver: {
          name: string;
          version: string;
          rules: Array<{
            id: string;
            name: string;
            shortDescription: { text: string };
            fullDescription: { text: string };
            defaultConfiguration: { level: string };
          }>;
        };
      };
      results: Array<{
        ruleId: string;
        level: string;
        message: { text: string };
        properties: Record<string, unknown>;
      }>;
    }>;
  };
}

export type EvolveStreamEvent =
  | EvolveMetaEvent
  | EvolveGenerationProgressEvent
  | EvolveGenerationSummaryEvent
  | EvolveLineageExportEvent;
