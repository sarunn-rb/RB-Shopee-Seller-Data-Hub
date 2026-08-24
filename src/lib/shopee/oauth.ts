import "server-only";

import crypto from "crypto";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { AuthContext } from "@/lib/auth/server";
import { OAuthStateSchema, type OAuthState } from "@/types/firestore";
import { getShopeeAuthorizationUrl, getShopeeBaseUrl, SHOPEE_PATHS, SHOPEE_REQUEST_TIMEOUT_MS } from "./config";
import { generateShopeeSignature } from "./signature";
import { ShopeeApiError } from "./errors";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1_000;

const TokenExchangeResponseSchema = z.object({
  error: z.string().default(""),
  message: z.string().optional(),
  request_id: z.string().optional(),
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  expire_in: z.number().int().positive().optional(),
  refresh_token_expire_in: z.number().int().positive().optional(),
}).passthrough();

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshTokenExpiresIn: number;
  providerRequestId?: string;
};

function timestampToMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis;
    return typeof toMillis === "function" ? Number(toMillis.call(value)) : null;
  }
  return null;
}

export function isSafeInternalReturnTo(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

export function validateOAuthState(
  rawState: unknown,
  auth: AuthContext,
  expectedState: string,
  nowMs = Date.now(),
): OAuthState {
  const parsed = OAuthStateSchema.parse(rawState);
  const expiresAtMs = timestampToMillis(parsed.expiresAt);
  if (
    parsed.state !== expectedState ||
    parsed.userId !== auth.uid ||
    parsed.organizationId !== auth.organizationId ||
    parsed.environment !== getServerEnv().SHOPEE_ENV ||
    !isSafeInternalReturnTo(parsed.returnTo) ||
    expiresAtMs === null ||
    expiresAtMs <= nowMs
  ) {
    throw new Error("invalid_oauth_state");
  }
  return parsed;
}

export async function createShopeeAuthorizationUrl(
  auth: AuthContext,
  returnTo = "/connections",
): Promise<URL> {
  const env = getServerEnv();
  const safeReturnTo = isSafeInternalReturnTo(returnTo) ? returnTo : "/connections";
  const state = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  await getFirebaseAdminFirestore().collection("oauth_states").doc(state).create({
    state,
    userId: auth.uid,
    organizationId: auth.organizationId,
    environment: env.SHOPEE_ENV,
    returnTo: safeReturnTo,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
  });

  const authorizationUrl = getShopeeAuthorizationUrl("authorize");
  authorizationUrl.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
  authorizationUrl.searchParams.set("auth_type", "seller");
  authorizationUrl.searchParams.set("redirect_uri", env.SHOPEE_REDIRECT_URI);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  return authorizationUrl;
}

export async function consumeOAuthState(state: string, auth: AuthContext): Promise<OAuthState> {
  const firestore = getFirebaseAdminFirestore();
  const stateRef = firestore.collection("oauth_states").doc(state);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    if (!snapshot.exists) throw new Error("invalid_oauth_state");
    const validated = validateOAuthState(snapshot.data(), auth, state);
    transaction.delete(stateRef);
    return validated;
  });
}

export async function exchangeAuthorizationCode(code: string, shopId: number): Promise<TokenExchangeResult> {
  const env = getServerEnv();
  const timestamp = Math.floor(Date.now() / 1_000);
  const url = new URL(SHOPEE_PATHS.TOKEN_GET, getShopeeBaseUrl());
  url.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", generateShopeeSignature(SHOPEE_PATHS.TOKEN_GET, timestamp));

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, shop_id: shopId, partner_id: Number(env.SHOPEE_PARTNER_ID) }),
      cache: "no-store",
      signal: AbortSignal.timeout(SHOPEE_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ShopeeApiError({
      kind: "provider_unavailable",
      endpointName: "get_token",
      errorCode: "network_error",
      retryable: false,
    });
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new ShopeeApiError({ kind: "invalid_provider_response", endpointName: "get_token", httpStatus: response.status });
  }
  const parsed = TokenExchangeResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ShopeeApiError({ kind: "invalid_provider_response", endpointName: "get_token", httpStatus: response.status });
  }
  if (!response.ok || parsed.data.error) {
    throw new ShopeeApiError({
      kind: "provider_error",
      endpointName: "get_token",
      errorCode: parsed.data.error || `http_${response.status}`,
      requestId: parsed.data.request_id,
      httpStatus: response.status,
    });
  }
  if (!parsed.data.access_token || !parsed.data.refresh_token || !parsed.data.expire_in) {
    throw new ShopeeApiError({
      kind: "invalid_provider_response",
      endpointName: "get_token",
      requestId: parsed.data.request_id,
      httpStatus: response.status,
    });
  }
  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    expiresIn: parsed.data.expire_in,
    refreshTokenExpiresIn: parsed.data.refresh_token_expire_in ?? 30 * 24 * 60 * 60,
    providerRequestId: parsed.data.request_id,
  };
}
