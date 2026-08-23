# Shopee Ads API Notes

Status: **blocked pending official Ads guide review and a redacted Sandbox response**.

The authorization guide confirms that a “Shopee On-Platform Ads API Guide” exists in the official documentation navigation, but this phase has not yet verified:

- exact Shop Ads endpoint paths and methods
- Seller In House System permission availability
- shop-level or merchant-level authentication
- request parameters and aggregation behavior
- date-range constraints
- pagination
- rate limits
- attribution definitions
- response fields and money units
- error behavior

No Ads endpoint, provider field, mapper, Zod response schema, or production metric has been implemented or invented.

## Required evidence before implementation

1. Current official endpoint documentation.
2. Permission shown for this Sandbox app.
3. Redacted Sandbox request and response with Shopee `request_id` preserved.
4. Confirmed date/pagination/rate-limit constraints.
5. Metric definitions reconciled with Shopee UI.
6. Confirmation that unexpected buyer PII is discarded.

Only after those items are recorded may the live mapper and Ads UI be finalized. Ads performance will be normalized in memory and will not be written to Firestore.
