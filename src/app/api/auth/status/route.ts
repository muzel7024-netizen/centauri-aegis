import { NextRequest, NextResponse } from "next/server";
import {
  isAuthEnabled,
  validateSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();

  if (!authEnabled) {
    return NextResponse.json({ authEnabled: false, authenticated: true });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ authEnabled: true, authenticated: false });
  }

  const session = validateSessionToken(token);

  return NextResponse.json({
    authEnabled: true,
    authenticated: session.valid,
    username: session.username,
  });
}
