# Shopee Ads API Notes

# Shopee Ads API Notes

Status: **Verified in Sandbox**.

This document outlines the behavior of the Shopee Ads Performance API based on actual Sandbox testing (August 2026).

## Verified Endpoint

- **Endpoint**: `/api/v2/ads/get_all_cpc_ads_daily_performance`
- **Method**: `POST`
- **Authentication**: Shop-level (`access_token` and `shop_id` required in base string)
- **Host (Sandbox)**: `https://openplatform.sandbox.test-stable.shopee.sg`

### Request Parameters (JSON Body)
- `start_date` (string): Format `DD-MM-YYYY` (e.g. "01-07-2026")
- `end_date` (string): Format `DD-MM-YYYY`

### Constraints
- **Date Range Limit**: Maximum 30 days per request.
- **Historical Limit**: Maximum 6 months into the past.
- **Pagination**: None. Returns a flat array of daily aggregates.

## Response Schema
```json
{
  "response": [
    {
      "date": "01-07-2026",
      "impression": 0,
      "clicks": 0,
      "ctr": 0,
      "direct_order": 0,
      "broad_order": 0,
      "direct_conversions": 0,
      "broad_conversions": 0,
      "direct_item_sold": 0,
      "broad_item_sold": 0,
      "direct_gmv": 0,
      "broad_gmv": 0,
      "expense": 0,
      "cost_per_conversion": 0,
      "direct_roas": 0,
      "broad_roas": 0
    }
  ]
}
```

## Security & Privacy
- No buyer PII is returned by this endpoint.
- Performance data will be queried live and **NOT** persisted to Firestore.
