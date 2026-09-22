import type { AttackPayload, AttackCategory, ModelTarget } from "@/lib/types";

export { injectionPayloads } from "./injection";
export { jailbreakPayloads } from "./jailbreak";
export { extractionPayloads } from "./extraction";
export { bypassPayloads } from "./bypass";
export { toolAbusePayloads } from "./tool-abuse";
export { multiTurnPayloads } from "./multi-turn";
export { encodingPayloads } from "./encoding";

import { injectionPayloads } from "./injection";
import { jailbreakPayloads } from "./jailbreak";
import { extractionPayloads } from "./extraction";
import { bypassPayloads } from "./bypass";
import { toolAbusePayloads } from "./tool-abuse";
import { multiTurnPayloads } from "./multi-turn";
import { encodingPayloads } from "./encoding";

/** All attack payloads from every category, combined into a single array. */
export const allPayloads: AttackPayload[] = [
  ...injectionPayloads,
  ...jailbreakPayloads,
  ...extractionPayloads,
  ...bypassPayloads,
  ...toolAbusePayloads,
  ...multiTurnPayloads,
  ...encodingPayloads,
];

/** Return all payloads that belong to the given category. */
export function getPayloadsByCategory(
  category: AttackCategory,
): AttackPayload[] {
  return allPayloads.filter((p) => p.category === category);
}

/** Look up a single payload by its unique id (e.g. "inj-001"). */
export function getPayloadById(id: string): AttackPayload | undefined {
  return allPayloads.find((p) => p.id === id);
}

/** Return payloads targeting a specific model. */
export function getPayloadsByModel(model: ModelTarget): AttackPayload[] {
  return allPayloads.filter(
    (p) => !p.modelTarget || p.modelTarget === model || p.modelTarget === "universal",
  );
}

/** Return payloads matching specific tags. */
export function getPayloadsByTag(tag: string): AttackPayload[] {
  return allPayloads.filter((p) => p.tags?.includes(tag));
}

/** Get all unique tags across all payloads. */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const p of allPayloads) {
    if (p.tags) {
      for (const t of p.tags) tags.add(t);
    }
  }
  return [...tags].sort();
}
