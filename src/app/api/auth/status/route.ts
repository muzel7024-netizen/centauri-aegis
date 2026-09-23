import { NextRequest, NextResponse } from "next/server";
import {
  isAuthEnabled,
  validateRequestAuth,
} from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authEnabled = isAuthEnabled();

  if (!authEnabled) {
    return NextResponse.json({ authEnabled: false, authenticated: true });
  }

  const auth = await validateRequestAuth(request);

  return NextResponse.json({
    authEnabled: true,
    authenticated: auth.authenticated,
    username: auth.username,
  });
}
