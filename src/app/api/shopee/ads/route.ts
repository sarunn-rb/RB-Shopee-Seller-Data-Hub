import { NextRequest, NextResponse } from "next/server";

import { toSafeApiError } from "@/lib/api-errors";
import { requireConnectionAccess } from "@/lib/auth/server";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { AdsRequestSchema } from "@/lib/shopee/ads-schemas";
import { AdsService } from "@/lib/shopee/ads";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const parsed = AdsRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
    }

    const { connectionId, action, params } = parsed.data;
    const { auth, connection } = await requireConnectionAccess(connectionId);
    if (connection.status !== "active") {
      return NextResponse.json({ error: "connection_not_active" }, { status: 409 });
    }
    const context = {
      organizationId: auth.organizationId,
      connectionId,
      shopId: connection.shopId,
    };

    let data: unknown;
    switch (action) {
      case "get_total_balance":
        data = await AdsService.getTotalBalance(context);
        break;
      case "get_all_cpc_ads_daily_performance":
        data = await AdsService.getDailyPerformance(context, params);
        break;
      case "get_all_cpc_ads_hourly_performance":
        data = await AdsService.getHourlyPerformance(context, params);
        break;
      case "get_product_level_campaign_id_list":
        data = await AdsService.getProductCampaignIdList(context, params);
        break;
      case "get_product_level_campaign_setting_info":
        data = await AdsService.getProductCampaignSettingInfo(context, params);
        break;
      case "get_gms_campaign_performance":
        data = await AdsService.getGmsCampaignPerformance(context, params);
        break;
      case "get_gms_item_performance":
        data = await AdsService.getGmsItemPerformance(context, params);
        break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const safe = toSafeApiError(error);
    return NextResponse.json(
      { error: safe.code, ...(safe.requestId ? { requestId: safe.requestId } : {}) },
      { status: safe.status },
    );
  }
}
