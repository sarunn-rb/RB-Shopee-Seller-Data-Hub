import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { AdsService } from "@/lib/shopee/ads";
import { z } from "zod";
import { getServerEnv } from "@/lib/env/server";

const requestSchema = z.object({
  connectionId: z.string().min(1),
  action: z.enum([
    "get_total_balance",
    "get_daily_performance",
    "get_hourly_performance",
    "get_product_campaign_id_list",
    "get_product_campaign_setting_info",
    "get_gms_campaign_performance",
    "get_gms_item_performance"
  ]),
  params: z.record(z.string(), z.any()).optional()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Verify session
    const env = getServerEnv();
    const sessionCookie = request.cookies.get(env.SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminAuth = getFirebaseAdminAuth();
    await adminAuth.verifySessionCookie(sessionCookie, true);
    
    // In V1, any authenticated user can view reporting. 
    // If strict RBAC was added to custom claims, verify it here.

    // 2. Parse request
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
    }

    const { connectionId, action, params } = parsed.data;

    // 3. Verify connection access
    const firestore = getFirebaseAdminFirestore();
    const connectionRef = firestore.collection("shopee_connections").doc(connectionId);
    const connectionSnap = await connectionRef.get();

    if (!connectionSnap.exists) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const connectionData = connectionSnap.data()!;
    const shopId = connectionData.shopId;

    // 4. Dispatch to AdsService
    let data;
    try {
      switch (action) {
        case "get_total_balance":
          data = await AdsService.getTotalBalance(connectionData.organizationId, connectionId, shopId);
          break;
        case "get_daily_performance":
          if (!params?.start_date || !params?.end_date) throw new Error("Missing start_date or end_date");
          data = await AdsService.getDailyPerformance(connectionData.organizationId, connectionId, shopId, String(params.start_date), String(params.end_date));
          break;
        case "get_hourly_performance":
          if (!params?.date) throw new Error("Missing date");
          data = await AdsService.getHourlyPerformance(connectionData.organizationId, connectionId, shopId, String(params.date));
          break;
        case "get_product_campaign_id_list":
          data = await AdsService.getProductCampaignIdList(connectionData.organizationId, connectionId, shopId, params || {});
          break;
        case "get_product_campaign_setting_info":
          data = await AdsService.getProductCampaignSettingInfo(connectionData.organizationId, connectionId, shopId, params || {});
          break;
        case "get_gms_campaign_performance":
          if (!params?.start_date || !params?.end_date) throw new Error("Missing start_date or end_date");
          data = await AdsService.getGmsCampaignPerformance(connectionData.organizationId, connectionId, shopId, String(params.start_date), String(params.end_date));
          break;
        case "get_gms_item_performance":
          if (!params?.start_date || !params?.end_date) throw new Error("Missing start_date or end_date");
          data = await AdsService.getGmsItemPerformance(connectionData.organizationId, connectionId, shopId, String(params.start_date), String(params.end_date));
          break;
        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }
    } catch (apiError: unknown) {
      console.error(`Shopee Ads API Error (${action}):`, apiError);
      const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: unknown) {
    console.error("Ads endpoint error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
