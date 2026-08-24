import { NextRequest, NextResponse } from "next/server";

import { requireSameOrigin } from "@/lib/auth/csrf";
import { removeSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    await removeSessionCookie();
    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
}
