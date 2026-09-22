/**
 * Shared helper for API routes to resolve API keys from request bodies.
 * Supports both the new apiKeyId (vault reference) and legacy apiKey (plaintext).
 */

import { resolveApiKey } from "@/lib/key-vault";

/**
 * Extract and resolve the API key from a request body.
 * Tries apiKeyId first (vault lookup), falls back to apiKey (backward compat).
 * Returns the plaintext key or null.
 */
export function resolveKeyFromBody(body: {
  apiKeyId?: string;
  apiKey?: string;
}): string | null {
  return resolveApiKey({
    apiKeyId: body.apiKeyId,
    apiKey: body.apiKey,
  });
}
