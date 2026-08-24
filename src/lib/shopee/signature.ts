import "server-only";

import crypto from "crypto";
import { getServerEnv } from "@/lib/env/server";

/**
 * Generate HMAC-SHA256 signature for Shopee API requests.
 * @param path The API path (e.g., /api/v2/shop/auth_partner)
 * @param timestamp The Unix timestamp in seconds
 * @param additionalParams Optional additional string parameters like access_token and shop_id for authenticated requests
 */
export function generateShopeeSignature(
  path: string,
  timestamp: number,
  additionalParams: string = ""
): string {
  const env = getServerEnv();
  const partnerId = env.SHOPEE_PARTNER_ID;
  const partnerKey = env.SHOPEE_PARTNER_KEY;

  return generateShopeeSignatureWithKey(partnerId, partnerKey, path, timestamp, additionalParams);
}

export function generateShopeeSignatureWithKey(
  partnerId: string,
  partnerKey: string,
  path: string,
  timestamp: number,
  additionalParams = "",
): string {
  const baseString = `${partnerId}${path}${timestamp}${additionalParams}`;
  return crypto
    .createHmac("sha256", partnerKey)
    .update(baseString)
    .digest("hex");
}
