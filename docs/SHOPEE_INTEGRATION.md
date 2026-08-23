# Shopee Integration

Status: authorization documentation reviewed; provider implementation not started.

Official source reviewed through the authenticated Shopee Open Platform documentation page:

- `https://open.shopee.com/developer-guide/20`
- Page title: Authorization and Authentication
- Page last updated: 2026-07-24
- Reviewed: 2026-08-23

## Verified authorization facts

- Seller authorization is required for non-public shop-management APIs.
- Seller In House System apps can generate the authorization link from Open Platform Console → App list → Authorize.
- The current authorization-link parameters include `partner_id`, `auth_type=seller`, `redirect_uri`, `response_type=code`, and optional `state`.
- Shopee returns `state` unchanged, so the application will use a random, unguessable, short-lived, one-time value for CSRF protection.
- Shop-account authorization redirects with a one-time `code` and `shop_id`.
- Main-account authorization redirects with a one-time `code` and `main_account_id`.
- The authorization code expires after 10 minutes and can be used once.
- Authorization validity can be selected up to 365 days; reauthorization is required after expiry.
- Access tokens are valid for 4 hours.
- Refresh tokens are valid for 30 days.
- After refresh, the previous access token remains valid for 5 minutes according to the current guide.
- Reauthorization refreshes both access and refresh tokens.

## Verified token exchange

Initial token exchange:

```text
POST /api/v2/auth/token/get
```

Sandbox host shown in the current official guide:

```text
https://openplatform.sandbox.test-stable.shopee.sg
```

The request uses public-level signing: `partner_id + api_path + timestamp`, HMAC-SHA256 with the Partner Key, lowercase hex. The Partner Key, authorization code, and returned tokens stay server-only.

This document does not authorize implementation from memory. Recheck the live guide immediately before implementing token refresh/cancel behavior and before production.

## Callback requirements

The application callback will:

1. validate query parameters
2. validate and transactionally consume OAuth state
3. exchange the one-time code immediately server-side
4. encrypt access and refresh tokens independently with AES-256-GCM
5. write sanitized connection metadata separately from credentials
6. validate the connection with a safe provider call
7. write a redacted audit event
8. redirect only to a safe internal route

No raw code or token will be returned to the browser.

## Console action still required

The screenshot supplied for the Sandbox app shows no Test Redirect URL Domain configured. Before authorization E2E, configure the stable staging callback domain in Shopee Console. The exact domain is not known yet and is therefore not guessed here.
