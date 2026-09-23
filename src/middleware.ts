import { NextRequest, NextResponse } from "next/server";
import {
  rateLimiter,
  getClientKey,
  resolveRateLimitTier,
  rateLimitHeaders,
} from "@/lib/rate-limit";

/**
 * Middleware to handle:
 * 1. Rate limiting on API routes (always active)
 * 2. Authentication (opt-in via env vars)
 *
 * Auth is considered enabled when both AEGIS_USERNAME and AEGIS_PASSWORD
 * are set AND AEGIS_AUTH_DISABLED is not "true"
 * (Legacy PINCER_* environment variables remain supported for backward compatibility).
 *
 * Unprotected paths:
 * - /login (login page)
 * - /api/auth/* (auth endpoints — still rate-limited)
 * - /_next/* (Next.js internals)
 * - /favicon.ico, static assets
 */

const PUBLIC_PATHS = [
  "/login",
  "/_next/",
  "/favicon.ico",
];

/** Paths that skip auth but NOT rate limiting */
const AUTH_EXEMPT_PATHS = [
  "/api/auth/",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isAuthExemptPath(pathname: string): boolean {
  return AUTH_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow fully public paths (no rate limiting, no auth)
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // --- Rate Limiting (applies to all API routes) ---
  const tier = resolveRateLimitTier(pathname);
  if (tier) {
    const clientKey = getClientKey(request);
    const result = rateLimiter.check(clientKey, tier);
    const headers = rateLimitHeaders(result);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter: result.resetSeconds,
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Allowed — continue but attach rate limit headers to the response
    // We need to let the request proceed and add headers to the eventual response
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    // If this is an auth-exempt API path, skip auth check
    if (isAuthExemptPath(pathname)) {
      return response;
    }

    // For other API routes, fall through to auth check below
    // but carry the rate-limit-augmented response forward
    return applyAuthCheck(request, pathname, response);
  }

  // --- Authentication (non-API page routes) ---
  return applyAuthCheck(request, pathname);
}

function applyAuthCheck(
  request: NextRequest,
  pathname: string,
  existingResponse?: NextResponse
): NextResponse {
  // Check if auth is enabled via env vars (AEGIS_* primary; PINCER_* legacy fallback)
  const authDisabled =
    process.env.AEGIS_AUTH_DISABLED === "true" ||
    process.env.PINCER_AUTH_DISABLED === "true"; // Legacy compatibility only — do not use for new deployments.
  const user = process.env.AEGIS_USERNAME || process.env.PINCER_USERNAME; // Legacy compatibility fallback
  const pass = process.env.AEGIS_PASSWORD || process.env.PINCER_PASSWORD; // Legacy compatibility fallback
  const authEnabled = !authDisabled && !!(user && pass);

  if (!authEnabled) {
    return existingResponse ?? NextResponse.next();
  }

  // Check for session cookie (aegis_session primary; pincer_session legacy fallback)
  const sessionCookie =
    request.cookies.get("aegis_session")?.value ||
    request.cookies.get("pincer_session")?.value; // Legacy compatibility only

  if (!sessionCookie) {
    // API routes get 401, pages get redirected to /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — let the request through.
  // Full HMAC validation happens in the auth status endpoint.
  return existingResponse ?? NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
