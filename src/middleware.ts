import { NextRequest, NextResponse } from "next/server";
import {
  rateLimiter,
  getClientKey,
  resolveRateLimitTier,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { validateRequestAuth } from "@/lib/auth";

/**
 * Middleware to handle:
 * 1. Rate limiting on API routes (always active)
 * 2. Authentication (opt-in via env vars)
 *
 * Auth is considered enabled when both AEGIS_USERNAME and AEGIS_PASSWORD
 * are set AND AEGIS_AUTH_DISABLED is not "true".
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

export async function middleware(request: NextRequest) {
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
    return await applyAuthCheck(request, pathname, response);
  }

  // --- Authentication (non-API page routes) ---
  return await applyAuthCheck(request, pathname);
}

async function applyAuthCheck(
  request: NextRequest,
  pathname: string,
  existingResponse?: NextResponse
): Promise<NextResponse> {
  const auth = await validateRequestAuth(request);

  if (!auth.authenticated) {
    // API routes get 401, pages get redirected to /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return existingResponse ?? NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
