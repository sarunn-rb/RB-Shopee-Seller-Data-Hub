# Shopee Integration

## Verification status

Official documentation reviewed on 2026-08-24:

- [Authorization and Authentication](https://open.shopee.com/developer-guide/20), last updated 2026-07-24
- [Shopee On-Platform Ads API Guide](https://open.shopee.com/developer-guide/277), last updated 2026-01-29
- current API reference pages linked from those guides

The integration is implemented and unit-tested. It is **not yet Sandbox E2E verified**, production verified, or Go-Live approved.

## Authorization flow

The current seller authorization link uses:

```text
GET https://open.shopee.com/auth                    (production)
GET https://open.sandbox.test-stable.shopee.com/auth (Sandbox)
```

Parameters: `partner_id`, `auth_type=seller`, `redirect_uri`, `response_type=code`, and native `state`. The Sandbox host was confirmed from this app's Shopee Open Platform Console authorization link on 2026-08-24. It redirects through `account.sandbox.test-stable.shopee.com`; `open.test-stable.shopee.com` is not used for this app's Sandbox seller authorization.

Shop authorization returns a one-time `code`, `shop_id`, and unchanged `state`. Main-account authorization may return `main_account_id`. The code is exchanged server-side at:

```text
POST /api/v2/auth/token/get
```

Token refresh uses:

```text
POST /api/v2/auth/access_token/get
```

The current refresh reference defines a 30-day, single-use rotating refresh token. A successful refresh replaces both tokens. Exact authorization/access-token lifetimes must be confirmed from the live provider response/console before production; stored expiry fields come only from verified response values or the documented 30-day refresh lifetime.

## OAuth state and callback

`oauth_states/{state}` stores `state`, `userId`, `organizationId`, `environment`, safe internal `returnTo`, `createdAt`, and `expiresAt`. State is 32 random bytes, valid for 10 minutes, tied to the current admin/org/environment, and deleted in the same Firestore transaction that validates it. Firestore TTL provides eventual cleanup of abandoned states.

Callback sequence:

1. require an active admin session and current membership
2. validate callback parameters with Zod
3. transactionally validate and consume state
4. exchange the one-time code without logging it or the response
5. validate token response before storage
6. encrypt access/refresh tokens independently with AES-256-GCM
7. preserve existing connection `createdAt` during reauthorization
8. call `get_shop_info` and persist only safe shop metadata
9. write a sanitized audit event after successful commits
10. redirect using fixed application status codes only

## Refresh concurrency

```text
transaction A: inspect expiry/version/lease → acquire short lease → commit
provider call: refresh exactly once outside Firestore transaction
transaction B: verify lease owner/version → rotate pair → increment version → clear lease
```

Concurrent callers wait for the lease holder and then use its newer token. An expired lease can be recovered. Permanent documented refresh failures persist `reauthorization_required` in a successful dedicated transaction. Network/server failures retain the existing authorization state and are not mislabeled as expiry.

## Cancellation/disconnect

The reviewed authorization guide documents seller-facing cancellation through `/cancel_auth` or Seller Centre. It does not document an applicable server-to-server revoke endpoint for this Seller In House flow. Therefore disconnect currently:

1. requires admin + org ownership
2. deletes encrypted credentials locally
3. marks the connection `disconnected`
4. records `providerRevocationStatus=manual_required`
5. writes an audit event after commit

This is explicitly **not** claimed as provider-side revocation. An admin must also cancel the authorization in Shopee.

## Sandbox E2E checklist

1. Sign in as an invited admin and verify the session cookie is HttpOnly/Secure on staging.
2. Connect Shopee and confirm callback state is deleted after one use.
3. Verify separate metadata and credential documents; confirm no plaintext token fields exist.
4. Confirm shop info populates shop name/region and status becomes `active`.
5. Run each live Ads action and capture sanitized `request_id` plus reconciliation evidence.
6. Force an access-token refresh and confirm `tokenVersion` increments once with no lingering lease.
7. Disconnect and confirm credential deletion plus `manual_required` provider cancellation status.
8. Cancel authorization in Shopee, reconnect, and confirm `createdAt` is preserved while `reauthorizedAt` changes.
