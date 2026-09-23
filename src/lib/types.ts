export type AttackCategory = "injection" | "jailbreak" | "extraction" | "bypass" | "tool_abuse" | "multi_turn" | "encoding";

export type Severity = "critical" | "high" | "medium" | "low";

export type AttackStatus = "pending" | "running" | "success" | "fail" | "error";

export type AnalysisClassification =
  | "refusal"
  | "partial_compliance"
  | "full_jailbreak"
  | "information_leakage"
  | "error";

export interface AnalysisResult {
  classification: AnalysisClassification;
  severityScore: number; // 1-10
  confidence: number; // 0-1
  leakedData: string[];
  reasoning: string;
  indicators: string[];
}

export type TargetStatus = "active" | "testing" | "unreachable" | "unconfigured";

export interface TargetConfig {
  id: string;
  name: string;
  description?: string;
  endpoint: string;
  /** @deprecated Use apiKeyId instead. Kept for backward compatibility during migration. */
  apiKey?: string;
  /** Opaque reference to a key stored in the server-side vault. */
  apiKeyId?: string;
  /** Masked display label (e.g., "sk-...abc") — safe to persist client-side. */
  apiKeyLabel?: string;
  model: string;
  provider: "openai" | "anthropic" | "openrouter" | "xai" | "kimi" | "nous" | "custom";
  connected: boolean;
  notes?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  status?: TargetStatus;
  createdAt?: number;
  updatedAt?: number;
}

export type ModelTarget = "gpt" | "claude" | "llama" | "universal";

export interface AttackPayload {
  id: string;
  name: string;
  category: AttackCategory;
  description: string;
  severity: Severity;
  prompt: string;
  systemPrompt?: string;
  tags?: string[];
  modelTarget?: ModelTarget;
}

export const MODEL_TARGET_LABELS: Record<ModelTarget, string> = {
  gpt: "GPT",
  claude: "Claude",
  llama: "Llama",
  universal: "Universal",
};

export interface AttackResult {
  id: string;
  payloadId: string;
  payloadName: string;
  category: AttackCategory;
  severity: Severity;
  status: AttackStatus;
  prompt: string;
  response: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  analysis: AnalysisResult;
  assessmentId?: string;
  targetId?: string;
}

export interface AttackRun {
  id: string;
  targetId: string;
  targetName: string;
  categories: AttackCategory[];
  results: AttackResult[];
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "cancelled";
  assessmentId?: string;
}

// ─── Assessment Types ──────────────────────────────────────────────────────────

export type AssessmentStatus =
  | "draft"
  | "ready"
  | "running"
  | "stopped"
  | "completed"
  | "failed";

export interface AssessmentConfig {
  categories: AttackCategory[];
  payloadSelection: "all" | "category" | "custom";
  customPayloadIds?: string[];
  includeVariants: boolean;
  variantTypes?: string[];
  chainIds?: string[];
  adaptiveEnabled: boolean;
  adaptiveIterations?: number;
  evolveEnabled: boolean;
  evolveGenerations?: number;
  concurrency: number;
}

export interface AssessmentSummary {
  totalTests: number;
  completedTests: number;
  breachCount: number;
  breachRate: number;
  meanLatencyMs: number;
  scoreGrade: "A+" | "A" | "B" | "C" | "D" | "F";
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL";
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface Assessment {
  id: string;
  name: string;
  description?: string;
  targetId: string;
  targetName: string;
  status: AssessmentStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  configuration: AssessmentConfig;
  runIds: string[];
  summary?: AssessmentSummary;
}

// ─── Finding Types ────────────────────────────────────────────────────────────

export type FindingSeverity = "critical" | "high" | "medium" | "low";
export type FindingStatus = "open" | "reviewed" | "resolved";

export interface Finding {
  id: string;
  assessmentId: string;
  targetId: string;
  title: string;
  category: AttackCategory;
  severity: FindingSeverity;
  confidence: number; // 0.0 - 1.0
  description: string;
  evidence: string[];
  affectedTests: string[];
  remediation: string;
  status: FindingStatus;
  createdAt: number;
  updatedAt: number;
}

export interface LLMRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  provider: TargetConfig["provider"];
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

export interface LLMResponse {
  content: string;
  error?: string;
  durationMs: number;
}

export const CATEGORY_LABELS: Record<AttackCategory, string> = {
  injection: "Prompt Injection",
  jailbreak: "Jailbreak",
  extraction: "Data Extraction",
  bypass: "Guardrail Bypass",
  tool_abuse: "Tool Abuse",
  multi_turn: "Multi-Turn Escalation",
  encoding: "Encoding Bypass",
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const PROVIDER_PRESETS: Record<
  TargetConfig["provider"],
  { endpoint: string; placeholder: string }
> = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    placeholder: "sk-...",
  },
  anthropic: {
    endpoint: "https://api.anthropic.com/v1/messages",
    placeholder: "sk-ant-...",
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    placeholder: "sk-or-...",
  },
  xai: {
    endpoint: "https://api.x.ai/v1/chat/completions",
    placeholder: "xai-...",
  },
  kimi: {
    endpoint: "https://api.kimi.com/coding/v1/chat/completions",
    placeholder: "sk-...",
  },
  nous: {
    endpoint: "https://inference-api.nousresearch.com/v1/chat/completions",
    placeholder: "sk-...",
  },
  custom: {
    endpoint: "",
    placeholder: "API key",
  },
};
