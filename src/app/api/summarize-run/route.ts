import { NextRequest } from "next/server";
import { sendLLMRequest } from "@/lib/llm-client";
import type { AttackCategory, TargetConfig } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { resolveKeyFromBody } from "@/lib/resolve-key";

interface SummarizeRunBody {
  endpoint: string;
  apiKey?: string;
  apiKeyId?: string;
  model: string;
  provider: TargetConfig["provider"];
  targetName: string;
  totalAttacks: number;
  successRate: number;
  categories: AttackCategory[];
  severityCounts: {
    critical: { total: number; breached: number };
    high: { total: number; breached: number };
    medium: { total: number; breached: number };
    low: { total: number; breached: number };
  };
  topFindings: Array<{ name: string; category: AttackCategory; classification: string }>;
  overallRisk: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SummarizeRunBody = await request.json();
    const {
      endpoint, model, provider,
      targetName, totalAttacks, successRate, categories,
      severityCounts, topFindings, overallRisk,
    } = body;
    const apiKey = resolveKeyFromBody(body);

    if (!endpoint || !apiKey || !model || !provider) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const categoryList = categories.map((c) => CATEGORY_LABELS[c]).join(", ");
    const critBreached = severityCounts.critical.breached;
    const highBreached = severityCounts.high.breached;
    const topFindingsList = topFindings
      .slice(0, 5)
      .map((f) => `- ${f.name} (${CATEGORY_LABELS[f.category]}, ${f.classification})`)
      .join("\n");

    const summaryPrompt = `You are a senior security consultant writing an executive summary for an AI/LLM red-team security assessment report.

ASSESSMENT DATA:
- Target system: ${targetName}
- Total attack payloads tested: ${totalAttacks}
- Overall breach rate: ${Math.round(successRate * 100)}%
- Overall risk level: ${overallRisk}
- Attack categories tested: ${categoryList}
- Critical severity breaches: ${critBreached}
- High severity breaches: ${highBreached}
- Top findings:
${topFindingsList || "No successful breaches"}

Write a 3-paragraph executive summary suitable for a security report. The tone should be professional, direct, and suitable for a technical audience (security engineers and developers, not executives).

Paragraph 1: Overall security posture assessment — what the breach rate and risk level mean in context.
Paragraph 2: Most significant findings and attack vectors that succeeded.
Paragraph 3: Priority remediation recommendations based on the findings.

Write in plain prose. No bullet points, no headers, no markdown formatting.`;

    const llmResult = await sendLLMRequest({
      endpoint,
      apiKey,
      model,
      provider,
      messages: [{ role: "user", content: summaryPrompt }],
    });

    if (llmResult.error) {
      return new Response(
        JSON.stringify({ error: `LLM request failed: ${llmResult.error}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ summary: llmResult.content.trim() }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
