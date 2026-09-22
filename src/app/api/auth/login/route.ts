import { NextRequest, NextResponse } from "next/server";
import {
  isAuthEnabled,
  validateCredentials,
  createSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth is not enabled" }, { status: 404 });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = createSessionToken(username);
    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400, // 24 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
