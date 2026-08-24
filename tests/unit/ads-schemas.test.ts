import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdsRequestSchema, AdsPerformanceListSchema, GmsItemPerformancePageSchema } from "@/lib/shopee/ads-schemas";

describe("Shopee Ads validation and mapping", () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-08-24T05:00:00Z") }));
  afterEach(() => vi.useRealTimers());

  it("enforces official DD-MM-YYYY history and 31-day bounds", () => {
    expect(AdsRequestSchema.safeParse({
      connectionId: "sandbox_shop_1",
      action: "get_all_cpc_ads_daily_performance",
      params: { start_date: "01-08-2026", end_date: "24-08-2026" },
    }).success).toBe(true);
    expect(AdsRequestSchema.safeParse({
      connectionId: "sandbox_shop_1",
      action: "get_all_cpc_ads_daily_performance",
      params: { start_date: "01-07-2026", end_date: "24-08-2026" },
    }).success).toBe(false);
    expect(AdsRequestSchema.safeParse({
      connectionId: "sandbox_shop_1",
      action: "get_all_cpc_ads_hourly_performance",
      params: { performance_date: "25-08-2026" },
    }).success).toBe(false);
  });

  it("rejects malformed payloads and strips unexpected row fields", () => {
    const valid = AdsPerformanceListSchema.parse([{
      date: "24-08-2026", impression: 10, clicks: 2, ctr: 20,
      direct_order: 1, broad_order: 1, direct_conversions: 1, broad_conversions: 1,
      direct_item_sold: 1, broad_item_sold: 1, direct_gmv: 100.25, broad_gmv: 120.25,
      expense: 20.5, cost_per_conversion: 20.5, direct_roas: 4.9, broad_roas: 5.8,
      buyer_email: "must-not-pass@example.com",
    }]);
    expect(valid[0]).not.toHaveProperty("buyer_email");
    expect(AdsPerformanceListSchema.safeParse([{ date: "24-08-2026" }]).success).toBe(false);
  });

  it("validates the paginated GMV Max item contract", () => {
    expect(GmsItemPerformancePageSchema.safeParse({
      campaign_id: 1,
      result_list: [],
      total: 0,
      has_next_page: false,
    }).success).toBe(true);
  });
});
