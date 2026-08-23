import "server-only";

import { getServerEnv } from "@/lib/env/server";
import { getShopeeBaseUrl } from "./config";
import { generateShopeeSignature } from "./signature";
import { getValidShopeeAccessToken } from "./tokens";

import { logApiInteraction } from "../logger";

export async function shopeeApiRequest<T>(
  path: string, // just the pathname, e.g. /api/v2/shop/get_shop_info
  organizationId: string,
  connectionId: string,
  shopId: number,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<T> {
  const env = getServerEnv();
  const accessToken = await getValidShopeeAccessToken(connectionId, shopId);
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Authenticated requests append access_token and shop_id to the base string
  const additionalParams = `${accessToken}${shopId}`;
  
  // The path for signature must NOT include query string
  const cleanPath = path.split('?')[0];
  const sign = generateShopeeSignature(cleanPath, timestamp, additionalParams);

  const url = new URL(cleanPath, getShopeeBaseUrl());
  url.searchParams.set("partner_id", env.SHOPEE_PARTNER_ID);
  url.searchParams.set("timestamp", timestamp.toString());
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", shopId.toString());
  url.searchParams.set("sign", sign);
  
  if (queryParams) {
    Object.entries(queryParams).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
  }

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  }

  const startTime = Date.now();
  let httpStatus: number | undefined;
  let responseData: Record<string, unknown> | undefined;
  let providerRequestId: string | undefined;

  try {
    const response = await fetch(url.toString(), options);
    httpStatus = response.status;
    
    if (!response.ok) {
      throw new Error(`Shopee API HTTP Error: ${response.status}`);
    }

    responseData = await response.json() as Record<string, unknown>;
    providerRequestId = responseData.request_id as string | undefined;
    
    if (responseData.error) {
      throw new Error(`Shopee API Error: ${responseData.error as string} - ${responseData.message as string}`);
    }

    return responseData.response as T;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log the error
    await logApiInteraction({
      event: "shopee_api_error",
      organizationId,
      connectionId,
      shopId,
      endpointName: cleanPath,
      httpStatus,
      providerRequestId,
      providerErrorCode: responseData?.error ? String(responseData.error) : "network_error",
      durationMs: Date.now() - startTime,
      message: errorMessage,
      metadata: { body, queryParams }
    });

    throw error;
  } finally {
    // Log success if no throw
    if (responseData && !responseData.error) {
      await logApiInteraction({
        event: "shopee_api_success",
        organizationId,
        connectionId,
        shopId,
        endpointName: cleanPath,
        httpStatus,
        providerRequestId,
        durationMs: Date.now() - startTime,
        metadata: { body, queryParams }
      });
    }
  }
}
