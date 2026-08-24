import { differenceInCalendarDays, isAfter, isBefore, isEqual, subMonths } from "date-fns";
import { z } from "zod";

export const OFFICIAL_ADS_DATE_FORMAT = "DD-MM-YYYY";
export const ADS_HISTORY_MONTHS = 6;
export const ADS_MAX_RANGE_DAYS = 31;

export function parseShopeeDate(value: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

const OfficialDateSchema = z.string().refine((value) => parseShopeeDate(value) !== null, {
  message: `Date must be a real calendar date in ${OFFICIAL_ADS_DATE_FORMAT} format.`,
});

function validateHistoricalDate(value: string, context: z.RefinementCtx) {
  const date = parseShopeeDate(value)!;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (isAfter(date, todayUtc)) {
    context.addIssue({ code: "custom", message: "Date cannot be in the future." });
  }
  if (isBefore(date, subMonths(todayUtc, ADS_HISTORY_MONTHS))) {
    context.addIssue({ code: "custom", message: "Date cannot be earlier than 6 months ago." });
  }
}

const HistoricalDateSchema = OfficialDateSchema.superRefine(validateHistoricalDate);

function validateDateRange(
  value: { start_date: string; end_date: string },
  context: z.RefinementCtx,
  options: { sameDateAllowed: boolean },
) {
    const start = parseShopeeDate(value.start_date)!;
    const end = parseShopeeDate(value.end_date)!;
    if (isAfter(start, end)) {
      context.addIssue({ code: "custom", path: ["start_date"], message: "start_date must be before end_date." });
      return;
    }
    if (!options.sameDateAllowed && isEqual(start, end)) {
      context.addIssue({ code: "custom", path: ["end_date"], message: "Daily performance requires at least two dates." });
    }
    if (differenceInCalendarDays(end, start) + 1 > ADS_MAX_RANGE_DAYS) {
      context.addIssue({ code: "custom", path: ["end_date"], message: "Date range cannot exceed 31 days." });
    }
}

function dateRangeSchema(options: { sameDateAllowed: boolean }) {
  return z.object({
    start_date: HistoricalDateSchema,
    end_date: HistoricalDateSchema,
  }).superRefine((value, context) => validateDateRange(value, context, options));
}

export const DailyPerformanceParamsSchema = dateRangeSchema({ sameDateAllowed: false });
export const HourlyPerformanceParamsSchema = z.object({
  performance_date: HistoricalDateSchema,
});
export const ProductCampaignIdListParamsSchema = z.object({
  ad_type: z.enum(["all", "auto", "manual"]).default("all"),
});
export const ProductCampaignSettingParamsSchema = z.object({
  campaign_id_list: z.array(z.coerce.number().int().positive()).min(1).max(5_000),
  info_type_list: z.array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])).min(1).max(4),
});
export const GmsCampaignPerformanceParamsSchema = z.object({
  start_date: HistoricalDateSchema,
  end_date: HistoricalDateSchema,
  campaign_id: z.coerce.number().int().positive().optional(),
}).superRefine((value, context) => validateDateRange(value, context, { sameDateAllowed: true }));
export const GmsItemPerformanceParamsSchema = z.object({
  start_date: HistoricalDateSchema,
  end_date: HistoricalDateSchema,
  campaign_id: z.coerce.number().int().positive().optional(),
  page_size: z.coerce.number().int().min(1).max(100).default(100),
}).superRefine((value, context) => validateDateRange(value, context, { sameDateAllowed: true }));

export const AdsRequestSchema = z.discriminatedUnion("action", [
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_total_balance"),
    params: z.object({}).optional().default({}),
  }),
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_all_cpc_ads_daily_performance"),
    params: DailyPerformanceParamsSchema,
  }),
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_all_cpc_ads_hourly_performance"),
    params: HourlyPerformanceParamsSchema,
  }),
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_product_level_campaign_id_list"),
    params: ProductCampaignIdListParamsSchema.optional().default({ ad_type: "all" }),
  }),
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_product_level_campaign_setting_info"),
    params: ProductCampaignSettingParamsSchema,
  }),
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_gms_campaign_performance"),
    params: GmsCampaignPerformanceParamsSchema,
  }),
  z.object({
    connectionId: z.string().min(1).max(200),
    action: z.literal("get_gms_item_performance"),
    params: GmsItemPerformanceParamsSchema,
  }),
]);
export type AdsRequest = z.infer<typeof AdsRequestSchema>;

const MetricNumberSchema = z.number().finite();

export const AdsPerformanceRecordSchema = z.object({
  date: z.string(),
  hour: z.number().int().min(0).max(23).optional(),
  impression: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  ctr: MetricNumberSchema,
  direct_order: z.number().int().nonnegative(),
  broad_order: z.number().int().nonnegative(),
  direct_conversions: MetricNumberSchema,
  broad_conversions: MetricNumberSchema,
  direct_item_sold: z.number().int().nonnegative(),
  broad_item_sold: z.number().int().nonnegative(),
  direct_gmv: MetricNumberSchema,
  broad_gmv: MetricNumberSchema,
  expense: MetricNumberSchema,
  cost_per_conversion: MetricNumberSchema,
  direct_roas: MetricNumberSchema,
  broad_roas: MetricNumberSchema,
});
export const AdsPerformanceListSchema = z.array(AdsPerformanceRecordSchema);

export const TotalBalanceResponseSchema = z.object({
  data_timestamp: z.number().int(),
  total_balance: MetricNumberSchema,
});

export const ProductCampaignListResponseSchema = z.object({
  shop_id: z.number().int().positive(),
  region: z.string(),
  has_next_page: z.boolean(),
  campaign_list: z.array(z.object({
    ad_type: z.enum(["auto", "manual"]),
    campaign_id: z.number().int().positive(),
  })),
});

const CampaignCommonInfoSchema = z.object({
  ad_type: z.enum(["auto", "manual"]),
  ad_name: z.string(),
  campaign_status: z.enum(["ongoing", "scheduled", "ended", "paused", "deleted", "closed"]),
  bidding_method: z.enum(["auto", "manual"]),
  campaign_placement: z.enum(["search", "discovery", "all"]),
  campaign_budget: MetricNumberSchema,
  campaign_duration: z.object({
    start_time: z.number().int(),
    end_time: z.number().int(),
  }),
  item_id_list: z.array(z.number().int().positive()),
});

export const ProductCampaignSettingResponseSchema = z.object({
  shop_id: z.number().int().positive(),
  region: z.string(),
  campaign_list: z.array(z.object({
    campaign_id: z.number().int().positive(),
    common_info: CampaignCommonInfoSchema.optional(),
    manual_bidding_info: z.record(z.string(), z.unknown()).optional(),
    auto_bidding_info: z.record(z.string(), z.unknown()).optional(),
    auto_product_ads_info: z.array(z.record(z.string(), z.unknown())).optional(),
  })),
});

export const GmsReportSchema = z.object({
  broad_cir: MetricNumberSchema,
  broad_gmv: MetricNumberSchema,
  broad_order: z.number().int().nonnegative(),
  broad_order_amount: z.number().int().nonnegative(),
  broad_roi: MetricNumberSchema,
  clicks: z.number().int().nonnegative(),
  expense: MetricNumberSchema,
  cpc: MetricNumberSchema,
  cpdc: MetricNumberSchema,
  cr: MetricNumberSchema,
  direct_cr: MetricNumberSchema,
  direct_cir: MetricNumberSchema,
  direct_order: z.number().int().nonnegative(),
  direct_order_amount: z.number().int().nonnegative(),
  direct_roi: MetricNumberSchema,
  impression: MetricNumberSchema,
});

export const GmsCampaignPerformanceResponseSchema = z.object({
  campaign_id: z.number().int().nonnegative(),
  report: GmsReportSchema,
});

export const GmsItemPerformancePageSchema = z.object({
  campaign_id: z.number().int().nonnegative(),
  result_list: z.array(z.object({
    item_id: z.number().int().positive(),
    report: GmsReportSchema,
  })),
  total: z.number().int().nonnegative(),
  has_next_page: z.boolean(),
});

export type AdsPerformanceRecord = z.infer<typeof AdsPerformanceRecordSchema>;
export type TotalBalanceResponse = z.infer<typeof TotalBalanceResponseSchema>;
