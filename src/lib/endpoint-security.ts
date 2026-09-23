/**
 * Target Endpoint Validation and SSRF Guard for Centauri Aegis.
 *
 * Ensures target endpoints are valid HTTP/HTTPS URLs and prevents unintended
 * server-side request forgery (SSRF) against cloud metadata services or internal networks.
 *
 * Localhost and private development targets (e.g., local Ollama, vLLM, private testing clusters)
 * are supported when explicitly enabled via configuration or AEGIS_ALLOW_PRIVATE_TARGETS=true.
 */

export interface EndpointValidationResult {
  allowed: boolean;
  reason?: string;
  isPrivateTarget?: boolean;
}

const FORBIDDEN_METADATA_HOSTS = new Set([
  "169.254.169.254",          // AWS / GCP / Azure IMDS
  "metadata.google.internal", // GCP metadata
  "instance-data",            // Legacy cloud metadata
  "fd00:ec2::254",            // AWS IPv6 IMDS
]);

function isPrivateIpOrHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  // Localhost aliases
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }

  // IPv4 Private Range checks (RFC 1918 & Carrier-grade NAT)
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, o1, o2] = ipv4Match.map(Number);
    if (o1 === 10) return true;                         // 10.0.0.0/8
    if (o1 === 172 && o2 >= 16 && o2 <= 31) return true; // 172.16.0.0/12
    if (o1 === 192 && o2 === 168) return true;          // 192.168.0.0/16
    if (o1 === 127) return true;                        // 127.0.0.0/8 loopback
    if (o1 === 169 && o2 === 254) return true;          // 169.254.0.0/16 link-local
    if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;// 100.64.0.0/10 CGNAT
  }

  return false;
}

/**
 * Check if the server environment has globally enabled private/local targets.
 */
export function arePrivateTargetsEnabled(): boolean {
  if (process.env.AEGIS_ALLOW_PRIVATE_TARGETS === "true") return true;
  if (process.env.PINCER_ALLOW_PRIVATE_TARGETS === "true") return true; // Legacy compatibility only — do not use for new deployments.
  // In development mode, allow local models (e.g. Ollama localhost:11434) by default
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

/**
 * Validates a target URL before outbound request execution.
 */
export function validateTargetEndpoint(
  rawUrl: string,
  explicitAllowPrivate?: boolean
): EndpointValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { allowed: false, reason: "Endpoint URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { allowed: false, reason: "Malformed endpoint URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Cloud metadata endpoints are unconditionally forbidden
  if (FORBIDDEN_METADATA_HOSTS.has(hostname) || hostname.startsWith("169.254.")) {
    return {
      allowed: false,
      reason: "Requests to cloud provider instance metadata services (169.254.x.x) are strictly blocked for security.",
    };
  }

  // 2. Local / Private targets
  const isPrivate = isPrivateIpOrHost(hostname);
  if (isPrivate) {
    const isAllowed = explicitAllowPrivate ?? arePrivateTargetsEnabled();
    if (!isAllowed) {
      return {
        allowed: false,
        isPrivateTarget: true,
        reason: `Target endpoint "${hostname}" resolves to a private or loopback address. Enable "Allow Private/Local Targets" in Centauri Aegis settings or set AEGIS_ALLOW_PRIVATE_TARGETS=true.`,
      };
    }
  }

  return { allowed: true, isPrivateTarget: isPrivate };
}
