import { NextRequest, NextResponse } from "next/server";
import { removeSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await removeSessionCookie();
  return NextResponse.json({ status: "success" }, { status: 200 });
}
