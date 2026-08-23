import { shopeeApiRequest } from "./client";

export interface AdsPerformanceRecord {
  date?: string;
  performance_date?: string;
  impression: number;
  clicks: number;
  ctr: number;
  direct_order: number;
  broad_order: number;
  direct_conversions: number;
  broad_conversions: number;
  direct_item_sold: number;
  broad_item_sold: number;
  direct_gmv: number;
  broad_gmv: number;
  expense: number;
  cost_per_conversion: number;
  direct_roas: number;
  broad_roas: number;
}

export interface TotalBalanceResponse {
  data_timestamp: number;
  total_balance: number;
}

export class AdsService {
  /**
   * Fetches the total ads balance for the shop.
   */
  static async getTotalBalance(organizationId: string, connectionId: string, shopId: number): Promise<TotalBalanceResponse> {
    const res = await shopeeApiRequest<{ response: TotalBalanceResponse }>(
      "/api/v2/ads/get_total_balance",
      organizationId,
      connectionId,
      shopId,
      "GET"
    );
    // Some endpoints wrap in 'response', some return directly. Let's return raw or unwrap if needed.
    // Our probe showed: {"success":true,"data":{"data_timestamp":1787498215,"total_balance":0}} (no 'response' wrapper, just raw data at root or error at root. But wait, shopee returns standard format. Let's return the whole payload)
    return res as unknown as TotalBalanceResponse; 
  }

  /**
   * Fetches daily CPC Ads performance.
   * @param startDate DD-MM-YYYY
   * @param endDate DD-MM-YYYY
   */
  static async getDailyPerformance(organizationId: string, connectionId: string, shopId: number, startDate: string, endDate: string): Promise<AdsPerformanceRecord[]> {
    const res = await shopeeApiRequest<{ response: AdsPerformanceRecord[] } | AdsPerformanceRecord[]>(
      "/api/v2/ads/get_all_cpc_ads_daily_performance",
      organizationId,
      connectionId,
      shopId,
      "POST",
      { start_date: startDate, end_date: endDate }
    );
    return res as AdsPerformanceRecord[];
  }

  /**
   * Fetches hourly CPC Ads performance for a specific date.
   * @param date DD-MM-YYYY
   */
  static async getHourlyPerformance(organizationId: string, connectionId: string, shopId: number, date: string): Promise<any> {
    const res = await shopeeApiRequest(
      "/api/v2/ads/get_all_cpc_ads_hourly_performance",
      organizationId,
      connectionId,
      shopId,
      "POST",
      { performance_date: date }
    );
    return res;
  }

  /**
   * Fetches product level campaign id list.
   */
  static async getProductCampaignIdList(organizationId: string, connectionId: string, shopId: number, queryParams: any = {}): Promise<any> {
    const res = await shopeeApiRequest(
      "/api/v2/ads/get_product_level_campaign_id_list",
      organizationId,
      connectionId,
      shopId,
      "POST", // or GET depending on actual doc, we will pass body just in case
      queryParams
    );
    return res;
  }

  /**
   * Fetches product level campaign setting info.
   */
  static async getProductCampaignSettingInfo(organizationId: string, connectionId: string, shopId: number, queryParams: any = {}): Promise<any> {
    const res = await shopeeApiRequest(
      "/api/v2/ads/get_product_level_campaign_setting_info",
      organizationId,
      connectionId,
      shopId,
      "POST",
      queryParams
    );
    return res;
  }

  /**
   * Fetches GMV Max (GMS) campaign performance.
   */
  static async getGmsCampaignPerformance(organizationId: string, connectionId: string, shopId: number, startDate: string, endDate: string): Promise<any> {
    const res = await shopeeApiRequest(
      "/api/v2/ads/get_gms_campaign_performance",
      organizationId,
      connectionId,
      shopId,
      "POST",
      { start_date: startDate, end_date: endDate, page_no: 1, page_size: 50 }
    );
    return res;
  }

  /**
   * Fetches GMV Max (GMS) item performance.
   */
  static async getGmsItemPerformance(organizationId: string, connectionId: string, shopId: number, startDate: string, endDate: string): Promise<any> {
    const res = await shopeeApiRequest(
      "/api/v2/ads/get_gms_item_performance",
      organizationId,
      connectionId,
      shopId,
      "POST",
      { start_date: startDate, end_date: endDate, page_no: 1, page_size: 50 }
    );
    return res;
  }
}
