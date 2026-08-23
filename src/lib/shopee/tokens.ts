import "server-only";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { decryptString, encryptString } from "./encryption";
import { getShopeeBaseUrl, SHOPEE_PATHS } from "./config";
import { generateShopeeSignature } from "./signature";
import { getServerEnv } from "@/lib/env/server";
import { ShopeeCredential } from "@/types/firestore";

// Token is considered expired if it expires in less than 5 minutes
const EXPIRY_BUFFER_SEC = 5 * 60;

/**
 * Returns a valid plaintext access token for the given connection ID.
 * If the current token is expired (or close to expiring), it will refresh
 * the token against the Shopee API and update Firestore transactionally.
 */
export async function getValidShopeeAccessToken(connectionId: string, shopId: number): Promise<string> {
  const firestore = getFirebaseAdminFirestore();
  const credentialRef = firestore.collection("shopee_credentials").doc(connectionId);
  const connectionRef = firestore.collection("shopee_connections").doc(connectionId);

  return firestore.runTransaction(async (t) => {
    const doc = await t.get(credentialRef);
    if (!doc.exists) {
      throw new Error("Credentials not found");
    }

    const data = doc.data() as ShopeeCredential;
    const now = Math.floor(Date.now() / 1000);

    // If token is still valid, decrypt and return
    if (data.expiresAt > now + EXPIRY_BUFFER_SEC) {
      return decryptString(data.accessToken);
    }

    // Token needs refresh
    const plaintextRefreshToken = decryptString(data.refreshToken);
    const env = getServerEnv();
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSignature(SHOPEE_PATHS.TOKEN_REFRESH, timestamp);

    const refreshUrl = new URL(SHOPEE_PATHS.TOKEN_REFRESH, getShopeeBaseUrl());
    refreshUrl.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
    refreshUrl.searchParams.set("timestamp", timestamp.toString());
    refreshUrl.searchParams.set("sign", sign);

    const res = await fetch(refreshUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: plaintextRefreshToken,
        shop_id: shopId,
        partner_id: parseInt(env.SHOPEE_PARTNER_ID, 10),
      }),
    });

    const refreshData = await res.json();

    if (refreshData.error) {
      // If refresh fails permanently, we should mark connection as expired
      t.update(connectionRef, {
        status: "expired",
        updatedAt: new Date(),
      });
      throw new Error(`Shopee Token Refresh Failed: ${refreshData.error} - ${refreshData.message}`);
    }

    const { access_token, refresh_token, expire_in } = refreshData;

    // Encrypt new tokens
    const newEncryptedAccess = encryptString(access_token);
    const newEncryptedRefresh = encryptString(refresh_token);
    const newExpiresAt = timestamp + expire_in;

    // Update credential document
    t.update(credentialRef, {
      accessToken: newEncryptedAccess,
      refreshToken: newEncryptedRefresh,
      expiresAt: newExpiresAt,
      tokenVersion: data.tokenVersion + 1,
      updatedAt: new Date(),
    });

    return access_token;
  });
}
