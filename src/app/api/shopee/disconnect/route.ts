import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { z } from "zod";
import { logApiInteraction } from "@/lib/logger";
import { FieldValue } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env/server";

const requestSchema = z.object({
  connectionId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verify session
    const env = getServerEnv();
    const sessionCookie = request.cookies.get(env.SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminAuth = getFirebaseAdminAuth();
    await adminAuth.verifySessionCookie(sessionCookie, true);
    
    // In a real app with strict RBAC, verify Admin role here
    
    // 2. Parse request
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
    }

    const { connectionId } = parsed.data;

    // 3. Perform Disconnect in Firestore Transaction
    const firestore = getFirebaseAdminFirestore();
    const connectionRef = firestore.collection("shopee_connections").doc(connectionId);
    const credentialRef = firestore.collection("shopee_credentials").doc(connectionId);

    await firestore.runTransaction(async (t) => {
      const connSnap = await t.get(connectionRef);
      if (!connSnap.exists) {
        throw new Error("Connection not found");
      }
      
      const connData = connSnap.data()!;

      // Delete the encrypted credentials
      t.delete(credentialRef);

      // Mark the connection as disconnected
      t.update(connectionRef, {
        status: "disconnected",
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      // Log the disconnect audit event
      await logApiInteraction({
        event: "shopee_shop_disconnected",
        organizationId: connData.organizationId,
        connectionId: connectionId,
        shopId: connData.shopId,
        message: "Shop disconnected manually by user",
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Disconnect endpoint error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
