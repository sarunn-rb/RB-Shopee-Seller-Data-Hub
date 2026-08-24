import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/server";
import type { AuthContext } from "@/lib/auth/server";
import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { logApiInteraction, logAuditEvent } from "@/lib/logger";
import { encryptString } from "@/lib/shopee/encryption";
import { isShopeeApiError, toSafeShopeeErrorCode } from "@/lib/shopee/errors";
import { consumeOAuthState, exchangeAuthorizationCode } from "@/lib/shopee/oauth";
import { getShopInfo } from "@/lib/shopee/shop";

const CallbackQuerySchema = z.object({
  state: z.string().min(32),
  code: z.string().min(1).optional(),
  shop_id: z.coerce.number().int().positive().optional(),
  main_account_id: z.coerce.number().int().positive().optional(),
  error: z.string().optional(),
}).refine((value) => Boolean(value.error || (value.code && value.shop_id)), {
  message: "invalid_callback",
});

function redirectWithStatus(request: NextRequest, returnTo: string, key: "success" | "error", value: string) {
  const target = new URL(returnTo, request.nextUrl.origin);
  target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  let returnTo = "/connections";
  let authContext: AuthContext | undefined;
  let callbackShopId: number | undefined;
  let stage: "callback" | "state" | "token_exchange" | "connection_validation" = "callback";
  try {
    const auth = await requireRole("admin");
    authContext = auth;
    const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = CallbackQuerySchema.parse(rawQuery);
    callbackShopId = query.shop_id;
    stage = "state";
    const state = await consumeOAuthState(query.state, auth);
    returnTo = state.returnTo;

    if (query.error || !query.code || !query.shop_id) {
      return redirectWithStatus(request, returnTo, "error", "authorization_rejected");
    }

    stage = "token_exchange";
    const token = await exchangeAuthorizationCode(query.code, query.shop_id);
    const env = getServerEnv();
    const firestore = getFirebaseAdminFirestore();
    const candidates = await firestore.collection("shopee_connections")
      .where("shopId", "==", query.shop_id)
      .get();
    const existingCandidate = candidates.docs.find((document) => {
      const value = document.data();
      return value.organizationId === auth.organizationId &&
        (value.environment === undefined || value.environment === env.SHOPEE_ENV);
    });
    const connectionId = existingCandidate?.id ?? `${env.SHOPEE_ENV}_shop_${query.shop_id}`;
    const connectionRef = firestore.collection("shopee_connections").doc(connectionId);
    const credentialRef = firestore.collection("shopee_credentials").doc(connectionId);
    const nowSeconds = Math.floor(Date.now() / 1_000);
    const accessTokenExpiresAt = nowSeconds + token.expiresIn;
    const refreshTokenExpiresAt = nowSeconds + token.refreshTokenExpiresIn;
    const existing = existingCandidate ?? await connectionRef.get();

    const batch = firestore.batch();
    batch.set(connectionRef, {
      organizationId: auth.organizationId,
      environment: env.SHOPEE_ENV,
      shopId: query.shop_id,
      ...(query.main_account_id ? { mainAccountId: query.main_account_id } : {}),
      status: "pending",
      connectedAt: FieldValue.serverTimestamp(),
      ...(existing.exists ? { reauthorizedAt: FieldValue.serverTimestamp() } : { createdAt: FieldValue.serverTimestamp() }),
      createdBy: auth.uid,
      accessTokenExpiresAt: new Date(accessTokenExpiresAt * 1_000),
      refreshTokenExpiresAt: new Date(refreshTokenExpiresAt * 1_000),
      lastErrorCode: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(credentialRef, {
      accessToken: encryptString(token.accessToken),
      refreshToken: encryptString(token.refreshToken),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      tokenVersion: existing.exists ? FieldValue.increment(1) : 1,
      refreshLease: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    try {
      stage = "connection_validation";
      const shopInfo = await getShopInfo(auth.organizationId, connectionId, query.shop_id);
      await connectionRef.update({
        status: "active",
        shopName: shopInfo.shop_name,
        ...(shopInfo.region ? { region: shopInfo.region } : {}),
        lastErrorCode: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const safeCode = toSafeShopeeErrorCode(error);
      await connectionRef.update({
        status: safeCode === "authorization_expired" ? "reauthorization_required" : "error",
        lastErrorCode: safeCode,
        lastErrorAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await logApiInteraction({
        event: "shopee_connection_validation_failed",
        organizationId: auth.organizationId,
        connectionId,
        shopId: query.shop_id,
        endpointName: "get_shop_info",
        providerErrorCode: safeCode,
      });
      return redirectWithStatus(request, returnTo, "error", "connection_validation_failed");
    }

    await logAuditEvent({
      action: existing.exists ? "shopee_reauthorized" : "shopee_connected",
      actorId: auth.uid,
      organizationId: auth.organizationId,
      connectionId,
      shopId: query.shop_id,
      metadata: { environment: env.SHOPEE_ENV, providerRequestId: token.providerRequestId },
    });
    return redirectWithStatus(request, returnTo, "success", existing.exists ? "reauthorized" : "connected");
  } catch (error) {
    if (authContext) {
      await logApiInteraction({
        event: "shopee_authorization_failed",
        organizationId: authContext.organizationId,
        shopId: callbackShopId,
        endpointName: stage,
        providerErrorCode: isShopeeApiError(error) ? error.errorCode ?? error.kind : stage,
        providerRequestId: isShopeeApiError(error) ? error.requestId : undefined,
      });
    }
    const safeCode = stage === "state"
      ? "invalid_state"
      : stage === "token_exchange"
        ? "token_exchange_failed"
        : "callback_failed";
    return redirectWithStatus(request, returnTo, "error", safeCode);
  }
}
