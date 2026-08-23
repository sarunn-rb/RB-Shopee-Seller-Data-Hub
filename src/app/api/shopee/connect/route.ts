import { NextResponse } from "next/server";
import crypto from "crypto";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/server";
import { getServerEnv } from "@/lib/env/server";
import { getShopeeAuthUrl, SHOPEE_PATHS } from "@/lib/shopee/config";
import { generateShopeeSignature } from "@/lib/shopee/signature";

export async function GET() {
  try {
    // Only authenticated users can initiate connection
    await requireAuth();

    // 1. Generate CSRF state
    const state = crypto.randomBytes(32).toString("hex");

    // 2. Save state to Firestore with a 10 min TTL
    const firestore = getFirebaseAdminFirestore();
    await firestore.collection("oauth_states").doc(state).set({
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // 3. Construct Authorization URL
    const env = getServerEnv();
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateShopeeSignature(SHOPEE_PATHS.AUTH_PARTNER, timestamp);

    const authUrl = new URL(SHOPEE_PATHS.AUTH_PARTNER, getShopeeAuthUrl());
    
    // Embed state into the redirect URI to ensure Shopee passes it back
    const redirectUri = new URL(env.SHOPEE_REDIRECT_URI);
    redirectUri.searchParams.set("state", state);
    
    authUrl.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
    authUrl.searchParams.set("timestamp", timestamp.toString());
    authUrl.searchParams.set("sign", sign);
    authUrl.searchParams.set("redirect", redirectUri.toString());

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("Shopee Connect Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
