import "server-only";

import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { getSessionCookie } from "./session";
import { DEFAULT_ORG_ID, Role } from "@/types/firestore";

export type SessionResult =
  | { isAuthenticated: false; reason: "no_cookie" | "invalid_cookie" | "not_invited" }
  | { isAuthenticated: true; uid: string; email: string; role: Role };

export async function verifySession(): Promise<SessionResult> {
  const sessionCookie = await getSessionCookie();

  if (!sessionCookie) {
    return { isAuthenticated: false, reason: "no_cookie" };
  }

  try {
    const auth = getFirebaseAdminAuth();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    
    // Check invite and role
    const firestore = getFirebaseAdminFirestore();
    const orgDoc = await firestore.collection("organizations").doc(DEFAULT_ORG_ID).get();
    
    if (!orgDoc.exists) {
      return { isAuthenticated: false, reason: "not_invited" };
    }

    const orgData = orgDoc.data();
    const members = orgData?.members || {};
    const member = members[decodedClaims.uid];

    if (!member) {
      return { isAuthenticated: false, reason: "not_invited" };
    }

    return {
      isAuthenticated: true,
      uid: decodedClaims.uid,
      email: decodedClaims.email || "",
      role: member.role,
    };
  } catch {
    return { isAuthenticated: false, reason: "invalid_cookie" };
  }
}

export async function requireAuth(): Promise<{ uid: string; email: string; role: Role }> {
  const result = await verifySession();
  if (!result.isAuthenticated) {
    throw new Error("Unauthorized");
  }
  return result;
}
