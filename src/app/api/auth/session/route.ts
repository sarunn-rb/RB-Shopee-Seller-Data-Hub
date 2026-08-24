import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSameOrigin } from "@/lib/auth/csrf";
import { getCurrentMembership } from "@/lib/auth/server";
import { hasRecentSignIn, setSessionCookie } from "@/lib/auth/session";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";

const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1_000;
const RequestSchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const body = RequestSchema.parse(await request.json());
    const auth = getFirebaseAdminAuth();
    const decoded = await auth.verifyIdToken(body.idToken, true);
    if (!hasRecentSignIn(decoded.auth_time)) {
      return NextResponse.json({ error: "sign_in_failed" }, { status: 401 });
    }
    if (!await getCurrentMembership(decoded.uid)) {
      return NextResponse.json({ error: "membership_required" }, { status: 403 });
    }
    const sessionCookie = await auth.createSessionCookie(body.idToken, { expiresIn: SESSION_EXPIRES_IN_MS });
    await setSessionCookie(sessionCookie);
    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ error: "sign_in_failed" }, { status: 401 });
  }
}
