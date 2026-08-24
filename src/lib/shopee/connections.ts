import type { ShopeeEnvironment } from "@/types/firestore";

export function getShopeeConnectionId(environment: ShopeeEnvironment, shopId: number): string {
  return `${environment}_shop_${shopId}`;
}
