import "server-only";

import { z } from "zod";

import {
  AdsPerformanceListSchema,
  GmsCampaignPerformanceResponseSchema,
  GmsItemPerformancePageSchema,
  ProductCampaignListResponseSchema,
  ProductCampaignSettingResponseSchema,
  TotalBalanceResponseSchema,
  type AdsPerformanceRecord,
} from "./ads-schemas";
import { shopeeApiRequest } from "./client";
import { SHOPEE_PATHS } from "./config";
import { ShopeeApiError } from "./errors";

const CAMPAIGN_PAGE_SIZE = 500;
const MAX_CAMPAIGN_PAGES = 100;
const MAX_ITEM_PAGES = 1_000;

type RequestContext = {
  organizationId: string;
  connectionId: string;
  shopId: number;
};

type Campaign = z.infer<typeof ProductCampaignListResponseSchema>["campaign_list"][number];
type GmsItem = z.infer<typeof GmsItemPerformancePageSchema>["result_list"][number];

function paginationLimitError(endpointName: string): ShopeeApiError {
  return new ShopeeApiError({
    kind: "invalid_provider_response",
    endpointName,
    errorCode: "pagination_limit_exceeded",
  });
}

export class AdsService {
  static getTotalBalance(context: RequestContext) {
    return shopeeApiRequest({
      ...context,
      path: SHOPEE_PATHS.ADS_TOTAL_BALANCE,
      endpointName: "get_total_balance",
      responseSchema: TotalBalanceResponseSchema,
      retrySafe: true,
    });
  }

  static getDailyPerformance(
    context: RequestContext,
    params: { start_date: string; end_date: string },
  ): Promise<AdsPerformanceRecord[]> {
    return shopeeApiRequest({
      ...context,
      path: SHOPEE_PATHS.ADS_DAILY_PERFORMANCE,
      endpointName: "get_all_cpc_ads_daily_performance",
      responseSchema: AdsPerformanceListSchema,
      queryParams: params,
      retrySafe: true,
    });
  }

  static getHourlyPerformance(
    context: RequestContext,
    params: { performance_date: string },
  ): Promise<AdsPerformanceRecord[]> {
    return shopeeApiRequest({
      ...context,
      path: SHOPEE_PATHS.ADS_HOURLY_PERFORMANCE,
      endpointName: "get_all_cpc_ads_hourly_performance",
      responseSchema: AdsPerformanceListSchema,
      queryParams: params,
      retrySafe: true,
    });
  }

  static async getProductCampaignIdList(
    context: RequestContext,
    params: { ad_type: "all" | "auto" | "manual" },
  ) {
    const endpointName = "get_product_level_campaign_id_list";
    const campaignList: Campaign[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_CAMPAIGN_PAGES; page += 1) {
      const response = await shopeeApiRequest({
        ...context,
        path: SHOPEE_PATHS.ADS_PRODUCT_CAMPAIGN_IDS,
        endpointName,
        responseSchema: ProductCampaignListResponseSchema,
        queryParams: {
          ad_type: params.ad_type,
          offset: String(offset),
          limit: String(CAMPAIGN_PAGE_SIZE),
        },
        retrySafe: true,
      });
      campaignList.push(...response.campaign_list);
      if (!response.has_next_page) {
        return { ...response, has_next_page: false, campaign_list: campaignList };
      }
      offset += CAMPAIGN_PAGE_SIZE;
    }
    throw paginationLimitError(endpointName);
  }

  static getProductCampaignSettingInfo(
    context: RequestContext,
    params: { campaign_id_list: number[]; info_type_list: Array<1 | 2 | 3 | 4> },
  ) {
    return (async () => {
      const campaignList: z.infer<typeof ProductCampaignSettingResponseSchema>["campaign_list"] = [];
      let metadata: Omit<z.infer<typeof ProductCampaignSettingResponseSchema>, "campaign_list"> | undefined;
      for (let index = 0; index < params.campaign_id_list.length; index += 100) {
        const response = await shopeeApiRequest({
          ...context,
          path: SHOPEE_PATHS.ADS_PRODUCT_CAMPAIGN_SETTINGS,
          endpointName: "get_product_level_campaign_setting_info",
          responseSchema: ProductCampaignSettingResponseSchema,
          queryParams: {
            campaign_id_list: params.campaign_id_list.slice(index, index + 100).join(","),
            info_type_list: params.info_type_list.join(","),
          },
          retrySafe: true,
        });
        metadata = { shop_id: response.shop_id, region: response.region };
        campaignList.push(...response.campaign_list);
      }
      if (!metadata) throw paginationLimitError("get_product_level_campaign_setting_info");
      return { ...metadata, campaign_list: campaignList };
    })();
  }

  static getGmsCampaignPerformance(
    context: RequestContext,
    params: { start_date: string; end_date: string; campaign_id?: number },
  ) {
    return shopeeApiRequest({
      ...context,
      path: SHOPEE_PATHS.ADS_GMS_CAMPAIGN_PERFORMANCE,
      endpointName: "get_gms_campaign_performance",
      responseSchema: GmsCampaignPerformanceResponseSchema,
      method: "POST",
      body: params,
    });
  }

  static async getGmsItemPerformance(
    context: RequestContext,
    params: { start_date: string; end_date: string; campaign_id?: number; page_size: number },
  ) {
    const endpointName = "get_gms_item_performance";
    const resultList: GmsItem[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_ITEM_PAGES; page += 1) {
      const response = await shopeeApiRequest({
        ...context,
        path: SHOPEE_PATHS.ADS_GMS_ITEM_PERFORMANCE,
        endpointName,
        responseSchema: GmsItemPerformancePageSchema,
        method: "POST",
        body: {
          start_date: params.start_date,
          end_date: params.end_date,
          campaign_id: params.campaign_id,
          offset,
          limit: params.page_size,
        },
      });
      resultList.push(...response.result_list);
      if (!response.has_next_page) {
        return { ...response, has_next_page: false, result_list: resultList };
      }
      offset += params.page_size;
    }
    throw paginationLimitError(endpointName);
  }
}
