import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { logApiInteraction } from "@/lib/logger";
import { getShopeeBaseUrl, SHOPEE_REQUEST_TIMEOUT_MS } from "./config";
import { ShopeeApiError, isShopeeApiError } from "./errors";
import { generateShopeeSignature } from "./signature";
import { getValidShopeeAccessToken } from "./tokens";

const EnvelopeSchema = z.object({
  error: z.string().default(""),
  message: z.string().optional(),
  warning: z.string().optional(),
  request_id: z.string().optional(),
  response: z.unknown().optional(),
}).passthrough();

const AUTH_ERROR_CODES = new Set(["error_auth", "shop_access_expired"]);
const PERMISSION_ERROR_CODES = new Set(["error_permission", "permission_denied", "forbidden"]);

export type ShopeeRequestOptions<T> = {
  path: string;
  endpointName: string;
  organizationId: string;
  connectionId: string;
  shopId: number;
  responseSchema: z.ZodType<T>;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  queryParams?: Record<string, string>;
  responseExtractor?: (payload: unknown) => unknown;
  retrySafe?: boolean;
};

function classifyProviderError(input: {
  endpointName: string;
  errorCode: string;
  requestId?: string;
  httpStatus: number;
}): ShopeeApiError {
  const rateLimited = input.httpStatus === 429 || input.errorCode.startsWith("ads.rate_limit");
  const authorizationExpired = AUTH_ERROR_CODES.has(input.errorCode);
  const permissionDenied = PERMISSION_ERROR_CODES.has(input.errorCode);
  const unavailable = input.httpStatus >= 500 || input.errorCode === "error_server" || input.errorCode === "error_network";

  return new ShopeeApiError({
    kind: rateLimited
      ? "rate_limited"
      : authorizationExpired
        ? "authorization_expired"
        : permissionDenied
          ? "permission_denied"
          : unavailable
            ? "provider_unavailable"
            : "provider_error",
    endpointName: input.endpointName,
    errorCode: input.errorCode,
    requestId: input.requestId,
    httpStatus: input.httpStatus,
    retryable: rateLimited || unavailable,
    reauthorizationRequired: authorizationExpired,
  });
}

async function boundedBackoff(attempt: number): Promise<void> {
  const base = Math.min(250 * 2 ** attempt, 1_000);
  const jitter = Math.floor(Math.random() * 100);
  await new Promise((resolve) => setTimeout(resolve, base + jitter));
}

export async function shopeeApiRequest<T>(options: ShopeeRequestOptions<T>): Promise<T> {
  const method = options.method ?? "GET";
  const maxTransientRetries = options.retrySafe ? 2 : 0;
  let transientAttempt = 0;
  let refreshedAfterAuthError = false;
  let forceRefreshOnNextAttempt = false;
  const startedAt = Date.now();

  while (true) {
    let httpStatus: number | undefined;
    let providerRequestId: string | undefined;
    let providerErrorCode: string | undefined;

    try {
      const accessToken = await getValidShopeeAccessToken(
        options.connectionId,
        options.shopId,
        { forceRefresh: forceRefreshOnNextAttempt },
      );
      forceRefreshOnNextAttempt = false;
      const timestamp = Math.floor(Date.now() / 1_000);
      const cleanPath = options.path.split("?")[0];
      const sign = generateShopeeSignature(
        cleanPath,
        timestamp,
        `${accessToken}${options.shopId}`,
      );
      const env = getServerEnv();
      const url = new URL(cleanPath, getShopeeBaseUrl());
      url.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
      url.searchParams.set("timestamp", timestamp.toString());
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("shop_id", options.shopId.toString());
      url.searchParams.set("sign", sign);
      for (const [key, value] of Object.entries(options.queryParams ?? {})) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" && options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(SHOPEE_REQUEST_TIMEOUT_MS),
      });
      httpStatus = response.status;

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ShopeeApiError({
          kind: "invalid_provider_response",
          endpointName: options.endpointName,
          httpStatus,
        });
      }

      const envelope = EnvelopeSchema.safeParse(payload);
      if (!envelope.success) {
        throw new ShopeeApiError({
          kind: "invalid_provider_response",
          endpointName: options.endpointName,
          httpStatus,
        });
      }
      providerRequestId = envelope.data.request_id;
      providerErrorCode = envelope.data.error || undefined;

      if (!response.ok || providerErrorCode) {
        throw classifyProviderError({
          endpointName: options.endpointName,
          errorCode: providerErrorCode ?? `http_${response.status}`,
          requestId: providerRequestId,
          httpStatus: response.status,
        });
      }

      const responsePayload = options.responseExtractor
        ? options.responseExtractor(payload)
        : envelope.data.response;
      const parsedResponse = options.responseSchema.safeParse(responsePayload);
      if (!parsedResponse.success) {
        throw new ShopeeApiError({
          kind: "invalid_provider_response",
          endpointName: options.endpointName,
          requestId: providerRequestId,
          httpStatus,
        });
      }

      await Promise.all([
        logApiInteraction({
          event: "shopee_api_success",
          organizationId: options.organizationId,
          connectionId: options.connectionId,
          shopId: options.shopId,
          endpointName: options.endpointName,
          httpStatus,
          providerRequestId,
          durationMs: Date.now() - startedAt,
          metadata: { body: options.body, queryParams: options.queryParams },
        }),
        getFirebaseAdminFirestore().collection("shopee_connections").doc(options.connectionId).update({
          lastSuccessfulApiCallAt: FieldValue.serverTimestamp(),
          lastErrorCode: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }).catch(() => undefined),
      ]);
      return parsedResponse.data;
    } catch (error) {
      const normalizedError = isShopeeApiError(error)
        ? error
        : new ShopeeApiError({
            kind: "provider_unavailable",
            endpointName: options.endpointName,
            errorCode: "network_error",
            retryable: true,
          });
      if (
        normalizedError.kind === "authorization_expired" &&
        !refreshedAfterAuthError
      ) {
        refreshedAfterAuthError = true;
        forceRefreshOnNextAttempt = true;
        continue;
      }
      if (
        normalizedError.retryable &&
        transientAttempt < maxTransientRetries
      ) {
        await boundedBackoff(transientAttempt);
        transientAttempt += 1;
        continue;
      }

      await logApiInteraction({
        event: "shopee_api_error",
        organizationId: options.organizationId,
        connectionId: options.connectionId,
        shopId: options.shopId,
        endpointName: options.endpointName,
        httpStatus,
        providerRequestId: normalizedError.requestId ?? providerRequestId,
        providerErrorCode: normalizedError.errorCode ?? normalizedError.kind,
        durationMs: Date.now() - startedAt,
        message: normalizedError.kind,
        metadata: { body: options.body, queryParams: options.queryParams },
      });
      throw normalizedError;
    }
  }
}
