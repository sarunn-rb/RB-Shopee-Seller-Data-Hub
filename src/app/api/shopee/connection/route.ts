import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { z } from "zod";
import { logApiInteraction } from "@/lib/logger";
import { getServerEnv } from "@/lib/env/server";

const requestSchema = z.object({
  connectionId: z.string().min(1),
});

export async function DELETE(request: NextRequest) {
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

    // 3. Perform Delete
    const firestore = getFirebaseAdminFirestore();
    const connectionRef = firestore.collection("shopee_connections").doc(connectionId);
    
    const connSnap = await connectionRef.get();
    if (!connSnap.exists) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    
    const connData = connSnap.data()!;

    // Only allow deleting if it's already disconnected (safety measure)
    if (connData.status === "active") {
      return NextResponse.json({ error: "Cannot delete an active connection. Disconnect it first." }, { status: 400 });
    }

    await connectionRef.delete();
    
    // Log the delete audit event
    await logApiInteraction({
      event: "shopee_shop_deleted",
      organizationId: connData.organizationId,
      connectionId: connectionId,
      shopId: connData.shopId,
      message: "Shop permanently removed from database",
    });

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Delete connection endpoint error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
