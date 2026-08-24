import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { toSafeApiError } from "@/lib/api-errors";
import { requireConnectionAccess, requireRole } from "@/lib/auth/server";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { logAuditEvent } from "@/lib/logger";

const RequestSchema = z.object({ connectionId: z.string().min(1).max(200) });

export async function DELETE(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    const auth = await requireRole("admin");
    const { connection } = await requireConnectionAccess(parsed.data.connectionId, auth);
    if (connection.status !== "disconnected") {
      return NextResponse.json({ error: "disconnect_first" }, { status: 409 });
    }

    const firestore = getFirebaseAdminFirestore();
    const batch = firestore.batch();
    batch.delete(firestore.collection("shopee_credentials").doc(parsed.data.connectionId));
    batch.delete(firestore.collection("shopee_connections").doc(parsed.data.connectionId));
    await batch.commit();
    await logAuditEvent({
      action: "shopee_connection_deleted",
      actorId: auth.uid,
      organizationId: auth.organizationId,
      connectionId: parsed.data.connectionId,
      shopId: connection.shopId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json({ error: safe.code }, { status: safe.status });
  }
}
