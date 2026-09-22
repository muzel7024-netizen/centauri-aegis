import type { TargetConfig } from "@/lib/types";

/**
 * Extract API key fields from a target for use in API request bodies.
 * Returns apiKeyId if available (secure path), falls back to apiKey (legacy).
 */
export function getTargetKeyFields(target: TargetConfig): {
  apiKeyId?: string;
  apiKey?: string;
} {
  // Prefer plaintext key when present (in-memory only) so requests still work
  // if the volatile server-side key vault was reset during dev/server restart.
  if (target.apiKey) {
    return { apiKey: target.apiKey };
  }
  if (target.apiKeyId) {
    return { apiKeyId: target.apiKeyId };
  }
  return {};
}

/**
 * Build the common request fields (endpoint, model, provider, key) for an API call.
 * Used to send red team or target config to API routes.
 */
export function getConfigRequestFields(config: TargetConfig): {
  endpoint: string;
  model: string;
  provider: TargetConfig["provider"];
  apiKeyId?: string;
  apiKey?: string;
} {
  return {
    endpoint: config.endpoint,
    model: config.model,
    provider: config.provider,
    ...getTargetKeyFields(config),
  };
}

/**
 * Check if a target has a usable API key (either vault-stored or legacy).
 */
export function targetHasKey(target: TargetConfig): boolean {
  return !!(target.apiKeyId || target.apiKey);
}

/**
 * Get display label for a target's API key.
 */
export function getKeyDisplayLabel(target: TargetConfig): string {
  if (target.apiKeyLabel) return target.apiKeyLabel;
  if (target.apiKey) {
    const k = target.apiKey;
    if (k.length <= 8) return "••••••••";
    return `${k.slice(0, 4)}...${k.slice(-4)}`;
  }
  return "No key";
}
