import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toSafeApiError } from "@/lib/api-errors";
import { requireConnectionAccess, requireRole } from "@/lib/auth/server";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/logger";

const RequestSchema = z.object({ connectionId: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    const auth = await requireRole("admin");
    const { connection } = await requireConnectionAccess(parsed.data.connectionId, auth);
    const firestore = getFirebaseAdminFirestore();
    const connectionRef = firestore.collection("shopee_connections").doc(parsed.data.connectionId);
    const credentialRef = firestore.collection("shopee_credentials").doc(parsed.data.connectionId);

    await firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(connectionRef);
      if (!current.exists) return;
      transaction.delete(credentialRef);
      transaction.update(connectionRef, {
        status: "disconnected",
        providerRevocationStatus: "manual_required",
        disconnectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await logAuditEvent({
      action: "shopee_disconnected_locally",
      actorId: auth.uid,
      organizationId: auth.organizationId,
      connectionId: parsed.data.connectionId,
      shopId: connection.shopId,
      metadata: { providerRevocationStatus: "manual_required" },
    });
    return NextResponse.json({ success: true, providerRevocationStatus: "manual_required" });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: safe.code }, { status: safe.status });
  }
}
