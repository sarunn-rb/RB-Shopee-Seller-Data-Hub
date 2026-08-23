import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/server";
import { getServerEnv } from "@/lib/env/server";
import { getShopeeBaseUrl, SHOPEE_PATHS } from "@/lib/shopee/config";
import { generateShopeeSignature } from "@/lib/shopee/signature";
import { encryptString } from "@/lib/shopee/encryption";
import { DEFAULT_ORG_ID } from "@/types/firestore";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const shopIdStr = searchParams.get("shop_id");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Shopee Auth Error:", error);
      return NextResponse.redirect(new URL(`/connections?error=${error}`, request.url));
    }

    if (!code || !shopIdStr || !state) {
      return NextResponse.redirect(new URL("/connections?error=missing_params", request.url));
    }

    const shopId = parseInt(shopIdStr, 10);

    // 1. Validate and consume State (CSRF)
    const firestore = getFirebaseAdminFirestore();
    const stateRef = firestore.collection("oauth_states").doc(state);
    
    await firestore.runTransaction(async (t) => {
      const stateDoc = await t.get(stateRef);
      if (!stateDoc.exists) {
        throw new Error("Invalid or expired state");
      }
      
      const data = stateDoc.data();
      if (data && data.expiresAt.toDate() < new Date()) {
        throw new Error("State expired");
      }

      // Consume the state so it can't be reused
      t.delete(stateRef);
    });

    // 2. Exchange code for tokens
    const env = getServerEnv();
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSignature(SHOPEE_PATHS.TOKEN_GET, timestamp);

    const tokenUrl = new URL(SHOPEE_PATHS.TOKEN_GET, getShopeeBaseUrl());
    tokenUrl.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
    tokenUrl.searchParams.set("timestamp", timestamp.toString());
    tokenUrl.searchParams.set("sign", sign);

    const tokenRes = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        shop_id: shopId,
        partner_id: parseInt(env.SHOPEE_PARTNER_ID, 10),
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Shopee Token Exchange Error:", tokenData);
      return NextResponse.redirect(new URL(`/connections?error=${tokenData.error}`, request.url));
    }

    const { access_token, refresh_token, expire_in } = tokenData;

    // 3. Encrypt Tokens
    const encryptedAccess = encryptString(access_token);
    const encryptedRefresh = encryptString(refresh_token);
    const expiresAt = timestamp + expire_in;

    const connectionId = `shop_${shopId}`;

    // 4. Save to Firestore (Connection Metadata + Credentials)
    const connectionRef = firestore.collection("shopee_connections").doc(connectionId);
    const credentialRef = firestore.collection("shopee_credentials").doc(connectionId);

    const batch = firestore.batch();

    batch.set(connectionRef, {
      organizationId: DEFAULT_ORG_ID,
      shopId: shopId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    batch.set(credentialRef, {
      accessToken: encryptedAccess,
      refreshToken: encryptedRefresh,
      expiresAt: expiresAt,
      tokenVersion: 1,
      updatedAt: new Date(),
    });

    // Also could write an audit log here
    const auditRef = firestore.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "shopee_connect",
      actorId: authResult.uid,
      shopId: shopId,
      timestamp: new Date(),
    });

    await batch.commit();

    // 5. Redirect back to UI
    return NextResponse.redirect(new URL("/connections?success=1", request.url));
  } catch (error: any) {
    console.error("Shopee Callback Error:", error);
    return NextResponse.redirect(new URL(`/connections?error=${error.message}`, request.url));
  }
}
