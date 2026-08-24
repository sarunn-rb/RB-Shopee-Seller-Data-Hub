# Shopee Ads API Notes

## Status and sources

All seven requested capabilities are implemented from the current official API reference and [Shopee On-Platform Ads API Guide](https://open.shopee.com/developer-guide/277), reviewed 2026-08-24. None has a captured real Sandbox `request_id` yet. Therefore:

```text
implemented: yes
official-doc verified: yes
Sandbox verified: no
production verified: no
Go-Live approved: no
```

Common behavior: Sandbox API host `https://openplatform.sandbox.test-stable.shopee.sg`; production API host `https://partner.shopeemobile.com`; shop-level HMAC auth with `access_token` and `shop_id`; standard envelope contains `error`, optional `message`/`warning`, `request_id`, and `response`. All returned provider data is validated and unknown Ads row fields are stripped before reaching the browser.

## Endpoint contract matrix

| Capability | Path / method | Parameters and bounds | Pagination | Response |
|---|---|---|---|---|
| Total balance | `GET /api/v2/ads/get_total_balance` | no endpoint-specific params | none | `response: { data_timestamp: int, total_balance: float }` |
| Daily CPC performance | `GET /api/v2/ads/get_all_cpc_ads_daily_performance` | query `start_date`, `end_date`; `DD-MM-YYYY`; today or earlier; <=6 months; not same date; max one month (app enforces <=31 inclusive days) | none; daily array | `response: DailyPerformance[]` |
| Hourly CPC performance | `GET /api/v2/ads/get_all_cpc_ads_hourly_performance` | query `performance_date`; `DD-MM-YYYY`; today or earlier; <=6 months | none; 24-or-fewer hourly rows | `response: HourlyPerformance[]`, each row has `hour` and `date` |
| Product campaign IDs | `GET /api/v2/ads/get_product_level_campaign_id_list` | query `ad_type` = `all`, `auto`, or `manual`; `offset`, `limit` | follows `has_next_page`; application requests 500/page with a bounded 100-page guard. Reference sample uses 5000 but declares no authoritative maximum | `response: { shop_id, region, has_next_page, campaign_list[] }` |
| Campaign settings | `GET /api/v2/ads/get_product_level_campaign_setting_info` | comma query `campaign_id_list` max 100 per provider request; `info_type_list` values 1–4 | application chunks the full bounded campaign list into sequential groups of 100 and combines responses | `response: { shop_id, region, campaign_list[] }` |
| GMV Max campaign | `POST /api/v2/ads/get_gms_campaign_performance` | JSON body `start_date`, `end_date`, optional `campaign_id` | none | `response: { campaign_id, report }` |
| GMV Max items | `POST /api/v2/ads/get_gms_item_performance` | JSON body dates, optional `campaign_id`, `offset`, `limit`; page-size max 100 | follows `has_next_page` until complete, with a bounded 1000-page guard | `response: { campaign_id, result_list[], total, has_next_page }` |

All seven references list `Seller In House System` as an allowed app type. Live permission still depends on the actual app approval/configuration and must be proven in Sandbox.

## Date-range caveat for GMV Max

The current GMV Max reference prose says a maximum three-month window while its business-error contract says the range cannot exceed one month. Until a real Sandbox response resolves that inconsistency, the application applies the conservative <=31 inclusive-day limit. Do not widen it from memory.

## Performance response schema

Daily/hourly rows contain:

```text
date, hour (hourly only), impression, clicks, ctr,
direct_order, broad_order, direct_conversions, broad_conversions,
direct_item_sold, broad_item_sold, direct_gmv, broad_gmv,
expense, cost_per_conversion, direct_roas, broad_roas
```

The official description defines direct/broad orders and GMV with a seven-day post-ad-click attribution window. `direct_*` is attributed to purchase of the clicked advertised item; `broad_*` includes other purchased items from the same shop under the documented attribution rule.

GMV Max report fields validated by the application include impressions/clicks/expense plus direct and broad order, GMV, conversion, CIR, and ROI metrics. Campaign settings accept only the documented campaign/common/manual/auto product configuration structures.

## Units and money

- counts are integers except where the official schema declares floats
- CTR/conversion/ROAS/ROI/CIR values are provider floats; the UI does not rescale them
- balance, expense, GMV, CPC, CPDC, budgets, and order values are provider floats in the shop/report currency
- these endpoints do **not** document micro-units; the UI must not divide money by 100,000
- `data_timestamp` and campaign duration timestamps are Unix seconds where documented

## Rate limits, retries, and request volume

Official error tables include partner/shop/API rate-limit codes but do not publish a numeric quota for these endpoints. The client preserves safe `request_id`, maps throttling to a typed error, and uses bounded backoff only for safe reads/transient failures. Invalid input, signature, permission, and permanent authorization errors are not blindly retried. POST reporting requests are not transient-retried because provider idempotency is not explicitly documented.

The browser queries only the selected shop after an explicit click, cancels obsolete requests, uses no polling, and keeps date ranges bounded. Ads responses remain in memory and are never written to Firestore.

## Sandbox evidence ledger

| Endpoint | Sandbox request_id | Reconciled with Shopee UI | Status |
|---|---:|---:|---|
| `get_total_balance` | not captured | no | pending |
| `get_all_cpc_ads_daily_performance` | not captured | no | pending |
| `get_all_cpc_ads_hourly_performance` | not captured | no | pending |
| `get_product_level_campaign_id_list` | not captured | no | pending |
| `get_product_level_campaign_setting_info` | not captured | no | pending |
| `get_gms_campaign_performance` | not captured | no | pending |
| `get_gms_item_performance` | not captured | no | pending |
