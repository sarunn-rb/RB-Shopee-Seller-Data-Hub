import "server-only";

import { getServerEnv } from "@/lib/env/server";

export function getShopeeBaseUrl() {
  const env = getServerEnv();
  if (env.SHOPEE_ENV === "production") {
    return "https://partner.shopeemobile.com";
  }
  return "https://openplatform.sandbox.test-stable.shopee.sg";
}

export function getShopeeAuthUrl() {
  const env = getServerEnv();
  // Using openplatform URL as mentioned in docs for authorization flow
  if (env.SHOPEE_ENV === "production") {
    return "https://openplatform.shopee.com";
  }
  return "https://openplatform.sandbox.test-stable.shopee.sg";
}

export const SHOPEE_PATHS = {
  AUTH_PARTNER: "/api/v2/shop/auth_partner",
  TOKEN_GET: "/api/v2/auth/token/get",
  TOKEN_REFRESH: "/api/v2/auth/access_token/get",
  SHOP_INFO: "/api/v2/shop/get_shop_info",
} as const;
