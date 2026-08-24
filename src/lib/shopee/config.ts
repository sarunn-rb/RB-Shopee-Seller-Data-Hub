import "server-only";

import { getServerEnv } from "@/lib/env/server";
import type { ShopeeEnvironment } from "@/types/firestore";

export function getShopeeBaseUrl() {
  const env = getServerEnv();
  if (env.SHOPEE_ENV === "production") {
    return "https://partner.shopeemobile.com";
  }
  return "https://openplatform.sandbox.test-stable.shopee.sg";
}

export function getShopeeAuthorizationUrl(mode: "authorize" | "cancel" = "authorize") {
  const env = getServerEnv();
  const path = mode === "cancel" ? "/cancel_auth" : "/auth";
  return new URL(path, getShopeeAuthorizationOrigin(env.SHOPEE_ENV));
}

export function getShopeeAuthorizationOrigin(environment: ShopeeEnvironment) {
  return environment === "production"
    ? "https://open.shopee.com"
    : "https://open.sandbox.test-stable.shopee.com";
}

export const SHOPEE_PATHS = {
  TOKEN_GET: "/api/v2/auth/token/get",
  TOKEN_REFRESH: "/api/v2/auth/access_token/get",
  SHOP_INFO: "/api/v2/shop/get_shop_info",
  ADS_TOTAL_BALANCE: "/api/v2/ads/get_total_balance",
  ADS_DAILY_PERFORMANCE: "/api/v2/ads/get_all_cpc_ads_daily_performance",
  ADS_HOURLY_PERFORMANCE: "/api/v2/ads/get_all_cpc_ads_hourly_performance",
  ADS_PRODUCT_CAMPAIGN_IDS: "/api/v2/ads/get_product_level_campaign_id_list",
  ADS_PRODUCT_CAMPAIGN_SETTINGS: "/api/v2/ads/get_product_level_campaign_setting_info",
  ADS_GMS_CAMPAIGN_PERFORMANCE: "/api/v2/ads/get_gms_campaign_performance",
  ADS_GMS_ITEM_PERFORMANCE: "/api/v2/ads/get_gms_item_performance",
} as const;

export const SHOPEE_REQUEST_TIMEOUT_MS = 15_000;
