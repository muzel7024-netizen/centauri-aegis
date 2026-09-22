import { NextRequest, NextResponse } from "next/server";
import { storeKey, deleteKey, getKeyLabel, hasKey } from "@/lib/key-vault";

/**
 * POST /api/keys — Store an API key in the server-side vault.
 * Body: { apiKey: string }
 * Returns: { keyId: string, label: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or empty apiKey" },
        { status: 400 }
      );
    }

    const { keyId, label } = storeKey(apiKey.trim());

    return NextResponse.json({ keyId, label });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/keys — Remove an API key from the vault.
 * Body: { keyId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyId } = body;

    if (!keyId || typeof keyId !== "string") {
      return NextResponse.json(
        { error: "Missing keyId" },
        { status: 400 }
      );
    }

    const deleted = deleteKey(keyId);

    return NextResponse.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/keys?keyId=xxx — Check if a key exists and get its label.
 */
export async function GET(request: NextRequest) {
  const keyId = request.nextUrl.searchParams.get("keyId");

  if (!keyId) {
    return NextResponse.json(
      { error: "Missing keyId query parameter" },
      { status: 400 }
    );
  }

  const exists = hasKey(keyId);
  const label = exists ? getKeyLabel(keyId) : null;

  return NextResponse.json({ exists, label });
}
