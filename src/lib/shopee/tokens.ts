import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { ShopeeCredentialSchema } from "@/types/firestore";
import { decryptString, encryptString } from "./encryption";
import { getShopeeBaseUrl, SHOPEE_PATHS, SHOPEE_REQUEST_TIMEOUT_MS } from "./config";
import { ShopeeApiError, isShopeeApiError } from "./errors";
import { generateShopeeSignature } from "./signature";
import {
  createTokenRefreshCoordinator,
  TokenCredentialRecord,
  TokenRefreshStore,
} from "./token-refresh";

const PermanentRefreshErrorCodes = new Set([
  "error_auth",
  "error_merchant_refresh_token",
  "error_shop_refresh_token",
  "merchant_access_expired",
  "merchant_no_linked",
  "refresh_token_expired",
  "shop_access_expired",
  "shop_no_linked",
]);

const RefreshEnvelopeSchema = z.object({
  error: z.string().default(""),
  message: z.string().optional(),
  request_id: z.string().optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  expire_in: z.number().int().positive().optional(),
}).passthrough();

const RefreshSuccessSchema = RefreshEnvelopeSchema.extend({
  error: z.literal(""),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expire_in: z.number().int().positive(),
});

function parseCredential(value: unknown): TokenCredentialRecord {
  const parsed = ShopeeCredentialSchema.parse(value);
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    accessTokenExpiresAt: parsed.accessTokenExpiresAt ?? parsed.expiresAt!,
    refreshTokenExpiresAt: parsed.refreshTokenExpiresAt,
    tokenVersion: parsed.tokenVersion,
    refreshLease: parsed.refreshLease,
  };
}

function createFirestoreTokenStore(): TokenRefreshStore {
  const firestore = getFirebaseAdminFirestore();

  return {
    async acquireLease(input) {
      const credentialRef = firestore.collection("shopee_credentials").doc(input.connectionId);
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(credentialRef);
        if (!snapshot.exists) {
          throw new ShopeeApiError({
            kind: "authorization_expired",
            endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
            errorCode: "credentials_not_found",
            reauthorizationRequired: true,
          });
        }

        const credential = parseCredential(snapshot.data());
        if (!input.forceRefresh && credential.accessTokenExpiresAt > input.now + input.expiryBufferSeconds) {
          return { kind: "token" as const, credential };
        }

        const lease = credential.refreshLease;
        if (lease && lease.ownerId !== input.ownerId && lease.expiresAt > input.now) {
          return {
            kind: "wait" as const,
            expectedTokenVersion: lease.expectedTokenVersion,
            leaseExpiresAt: lease.expiresAt,
          };
        }

        transaction.update(credentialRef, {
          refreshLease: {
            ownerId: input.ownerId,
            expectedTokenVersion: credential.tokenVersion,
            expiresAt: input.leaseExpiresAt,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        return {
          kind: "lease" as const,
          credential,
          ownerId: input.ownerId,
          expectedTokenVersion: credential.tokenVersion,
        };
      });
    },

    async commitRotation(input) {
      const credentialRef = firestore.collection("shopee_credentials").doc(input.connectionId);
      const connectionRef = firestore.collection("shopee_connections").doc(input.connectionId);

      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(credentialRef);
        if (!snapshot.exists) {
          throw new ShopeeApiError({
            kind: "authorization_expired",
            endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
            errorCode: "credentials_not_found",
            reauthorizationRequired: true,
          });
        }

        const current = parseCredential(snapshot.data());
        if (current.tokenVersion > input.expectedTokenVersion) {
          return { kind: "newer" as const, credential: current };
        }
        if (
          current.tokenVersion !== input.expectedTokenVersion ||
          current.refreshLease?.ownerId !== input.ownerId
        ) {
          throw new ShopeeApiError({
            kind: "token_refresh_conflict",
            endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
            errorCode: "token_version_conflict",
          });
        }

        const next: TokenCredentialRecord = {
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          refreshTokenExpiresAt: input.refreshTokenExpiresAt,
          tokenVersion: current.tokenVersion + 1,
        };

        transaction.update(credentialRef, {
          ...next,
          expiresAt: FieldValue.delete(),
          refreshLease: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(connectionRef, {
          accessTokenExpiresAt: new Date(input.accessTokenExpiresAt * 1_000),
          refreshTokenExpiresAt: new Date(input.refreshTokenExpiresAt * 1_000),
          lastErrorCode: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { kind: "committed" as const, credential: next };
      });
    },

    async releaseLease(input) {
      const credentialRef = firestore.collection("shopee_credentials").doc(input.connectionId);
      const connectionRef = firestore.collection("shopee_connections").doc(input.connectionId);

      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(credentialRef);
        if (!snapshot.exists) {
          return;
        }
        const current = parseCredential(snapshot.data());
        if (
          current.tokenVersion !== input.expectedTokenVersion ||
          current.refreshLease?.ownerId !== input.ownerId
        ) {
          return;
        }

        transaction.update(credentialRef, {
          refreshLease: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(connectionRef, {
          ...(input.reauthorizationRequired ? { status: "reauthorization_required" } : {}),
          lastErrorCode: input.errorCode,
          lastErrorAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    },
  };
}

async function refreshShopeeTokens(input: { shopId: number; refreshToken: string }) {
  const env = getServerEnv();
  const timestamp = Math.floor(Date.now() / 1_000);
  const url = new URL(SHOPEE_PATHS.TOKEN_REFRESH, getShopeeBaseUrl());
  url.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
  url.searchParams.set("timestamp", timestamp.toString());
  url.searchParams.set("sign", generateShopeeSignature(SHOPEE_PATHS.TOKEN_REFRESH, timestamp));

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: input.refreshToken,
        shop_id: input.shopId,
        partner_id: Number(env.SHOPEE_PARTNER_ID),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(SHOPEE_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ShopeeApiError({
      kind: "provider_unavailable",
      endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
      errorCode: "network_error",
      retryable: false,
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ShopeeApiError({
      kind: "invalid_provider_response",
      endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
      httpStatus: response.status,
    });
  }

  const envelope = RefreshEnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    throw new ShopeeApiError({
      kind: "invalid_provider_response",
      endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
      httpStatus: response.status,
    });
  }
  if (!response.ok || envelope.data.error) {
    const errorCode = envelope.data.error || `http_${response.status}`;
    const permanent = PermanentRefreshErrorCodes.has(errorCode);
    throw new ShopeeApiError({
      kind: permanent ? "authorization_expired" : "provider_unavailable",
      endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
      errorCode,
      requestId: envelope.data.request_id,
      httpStatus: response.status,
      retryable: false,
      reauthorizationRequired: permanent,
    });
  }

  const success = RefreshSuccessSchema.safeParse(envelope.data);
  if (!success.success) {
    throw new ShopeeApiError({
      kind: "invalid_provider_response",
      endpointName: SHOPEE_PATHS.TOKEN_REFRESH,
      requestId: envelope.data.request_id,
      httpStatus: response.status,
    });
  }

  return {
    accessToken: success.data.access_token,
    refreshToken: success.data.refresh_token,
    expiresIn: success.data.expire_in,
  };
}

export async function getValidShopeeAccessToken(
  connectionId: string,
  shopId: number,
  options: { forceRefresh?: boolean } = {},
): Promise<string> {
  const coordinator = createTokenRefreshCoordinator({
    store: createFirestoreTokenStore(),
    refreshProvider: refreshShopeeTokens,
    encrypt: encryptString,
    decrypt: decryptString,
    isPermanentRefreshFailure: (error) => isShopeeApiError(error) && error.reauthorizationRequired,
    errorCode: (error) => isShopeeApiError(error) ? error.errorCode ?? error.kind : "provider_unavailable",
  });
  return coordinator({ connectionId, shopId, forceRefresh: options.forceRefresh });
}

export const TOKEN_REFRESH_PERMANENT_ERROR_CODES = PermanentRefreshErrorCodes;
