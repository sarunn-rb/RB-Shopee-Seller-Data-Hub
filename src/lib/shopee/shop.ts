import "server-only";

import { z } from "zod";

import { shopeeApiRequest } from "./client";
import { SHOPEE_PATHS } from "./config";

export const ShopInfoSchema = z.object({
  shop_name: z.string(),
  shop_description: z.string().optional(),
  shop_logo: z.string().optional(),
  region: z.string().optional(),
  status: z.string().optional(),
  shop_id: z.number().int().positive().optional(),
}).passthrough();

export type ShopInfo = z.infer<typeof ShopInfoSchema>;

export function getShopInfo(organizationId: string, connectionId: string, shopId: number) {
  return shopeeApiRequest({
    path: SHOPEE_PATHS.SHOP_INFO,
    endpointName: "get_shop_info",
    organizationId,
    connectionId,
    shopId,
    responseSchema: ShopInfoSchema,
    retrySafe: true,
  });
}
