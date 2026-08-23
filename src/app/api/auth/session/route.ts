import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { setSessionCookie } from "@/lib/auth/session";
import { DEFAULT_ORG_ID } from "@/types/firestore";

// Expires in 14 days
const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = getFirebaseAdminAuth();
    
    // Verify the ID token first
    const decodedIdToken = await auth.verifyIdToken(idToken);
    
    // Check invite/organization membership
    const firestore = getFirebaseAdminFirestore();
    const orgDoc = await firestore.collection("organizations").doc(DEFAULT_ORG_ID).get();
    
    if (!orgDoc.exists) {
      return NextResponse.json({ error: "Forbidden: Not Invited" }, { status: 403 });
    }

    const orgData = orgDoc.data();
    const members = orgData?.members || {};
    
    if (!members[decodedIdToken.uid]) {
      return NextResponse.json({ error: "Forbidden: Not Invited" }, { status: 403 });
    }

    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_IN_MS });

    await setSessionCookie(sessionCookie);

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
