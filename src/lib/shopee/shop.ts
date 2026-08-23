import "server-only";

import { shopeeApiRequest } from "./client";
import { SHOPEE_PATHS } from "./config";

export interface ShopInfo {
  shop_name: string;
  shop_description: string;
  shop_logo: string;
  status: string;
  // ... other fields as per documentation
}

export async function getShopInfo(organizationId: string, connectionId: string, shopId: number): Promise<ShopInfo> {
  return shopeeApiRequest<ShopInfo>(
    SHOPEE_PATHS.SHOP_INFO,
    organizationId,
    connectionId,
    shopId,
    "GET"
  );
}
