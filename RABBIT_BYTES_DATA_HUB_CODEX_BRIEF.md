# Rabbit Bytes Data Hub — Codex Implementation Brief

> Internal web application for Rabbit Bytes  
> Initial provider: Shopee Open Platform  
> Initial dataset: Shopee Shop Ads only  
> Data strategy: **Live API query — do not persist Ads performance data**  
> Shopee app model: **Registered Business Seller / Seller In House System**  
> Delivery path: **Sandbox staging → security hardening → Production / Go-Live readiness**

---

## 1. Project objective

Build **Rabbit Bytes Data Hub**, an internal application that lets authorized Rabbit Bytes users connect Rabbit Bytes-owned Shopee shops and query Shopee Shop Ads performance directly from the official Shopee Open Platform API.

The application must:

1. Require login.
2. Support invite-only Rabbit Bytes users.
3. Support multiple connected Shopee shops.
4. Use the official Shopee authorization flow.
5. Securely store only connection metadata and encrypted Shopee credentials/tokens.
6. Refresh/rotate Shopee tokens safely.
7. Query Shop Ads data **live from Shopee** when requested by the user.
8. Normalize API responses in memory/server-side for UI consumption.
9. **Not store historical Ads performance data in Firestore.**
10. Provide useful connection/API diagnostics without leaking secrets.
11. Work in Shopee Sandbox first.
12. Be structured so Production credentials can be enabled cleanly after Shopee Go-Live approval.

This is v1. Keep it focused.

---

## 2. Core product flow

```text
Rabbit Bytes User
      ↓
Login
      ↓
Rabbit Bytes Data Hub
      ↓
Connections
      ↓
Connect Shopee
      ↓
Shopee Open Platform Authorization
      ↓
Callback → exchange authorization code
      ↓
Encrypt access_token + refresh_token
      ↓
Store connection metadata + encrypted credentials in Firestore
      ↓
User opens Shopee Ads
      ↓
Next.js server validates session and shop access
      ↓
Ensure Shopee access token is healthy
      ↓
Refresh token if necessary
      ↓
Call Shopee Shop Ads API live
      ↓
Normalize response server-side
      ↓
Return sanitized reporting JSON to browser
      ↓
Render dashboard/table
```

**Performance data never becomes a Firestore reporting warehouse.**

---

# 3. Required stack

## Frontend / application server

- **Next.js** with App Router
- **React**
- **TypeScript** with `strict: true`
- **pnpm**

Use server components/server routes where appropriate.

## UI

- **Tailwind CSS**
- **shadcn/ui**
- **@tabler/icons-react**

### Icon rules

Use Tabler Icons for application UI.

```tsx
import {
  IconLayoutDashboard,
  IconChartBar,
  IconPlugConnected,
  IconRefresh,
  IconHistory,
  IconUsers,
  IconSettings,
} from "@tabler/icons-react";
```

Rules:

- Do not use Lucide.
- Do not use emoji as UI icons.
- Do not use an icon font.
- Do not create custom SVGs when Tabler already has an equivalent.
- Official brand assets may be used for Shopee branding where appropriate.

## Hosting

- **Vercel**

Use separate configuration for:

- local development
- staging / Shopee Sandbox
- production / Shopee Production

## Identity and metadata storage

- **Firebase Authentication**
- **Cloud Firestore**
- **Firebase Admin SDK** on the server

## Validation

- **Zod**

## Testing

Recommended:

- Vitest
- React Testing Library
- Playwright

Equivalent current tools are acceptable if justified.

## Monitoring / logs

- Vercel logs
- Structured server logging with strict redaction
- Small Firestore audit/API diagnostic log collections if useful
- Optional Sentry

The app must work without Sentry.

---

# 4. Important architecture decision: live data only

This application is **not a Shopee Ads data warehouse**.

Do not create collections for:

```text
ads_daily
campaign_daily
shop_daily
ads_history
ads_snapshots
monthly_ads_summary
```

Do not schedule background performance-data ingestion.

Do not backfill Ads performance into Firestore.

When the user requests Ads data:

```text
Browser
   ↓
Next.js server route / server action
   ↓
Shopee Open API
   ↓
server-side normalization
   ↓
Browser
```

The browser must never call private Shopee APIs directly.

### Optional short-lived cache

V1 may operate with **no performance-data cache**.

If real usage later shows repeated identical requests are hitting Shopee rate limits, a short-lived cache may be introduced, but it must:

- be explicitly documented
- have a short TTL
- not become permanent reporting storage
- be keyed by shop/date/filter scope
- never cache credentials

Do not add Redis/KV in the initial implementation unless actual provider limits justify it.

---

# 5. Firebase authentication design

Use Firebase Authentication for user identity.

V1 requirements:

- Email/password login
- Invite-only access
- No public registration
- Password reset
- Sign out
- Admin-managed members

## Recommended Next.js session model

Do **not** rely only on a browser-held Firebase ID token for application authorization.

Use this flow:

```text
Firebase client sign-in
      ↓
Firebase ID token
      ↓
POST /api/auth/session
      ↓
Firebase Admin verifies ID token
      ↓
Create Firebase session cookie
      ↓
Set Secure + HttpOnly cookie
      ↓
Server verifies session cookie on protected requests
```

Create helpers such as:

```text
src/lib/firebase/admin.ts
src/lib/firebase/client.ts
src/lib/auth/session.ts
src/lib/auth/permissions.ts
```

Session cookie requirements:

- HttpOnly
- Secure in production
- SameSite appropriate for the app
- finite expiry
- revoked/cleared on sign out

Do not expose Firebase service credentials to browser code.

---

# 6. User model and roles

Roles:

```text
admin
member
```

## Admin

Can:

- access reporting
- connect Shopee shops
- reauthorize shops
- disconnect shops
- inspect connection/API logs
- invite users
- update roles

## Member

Can:

- access reporting
- view connected shop status
- query Ads data
- view safe API diagnostics

Member must not:

- connect/disconnect/reauthorize shops
- read credential documents
- view encryption metadata unnecessarily
- manage members

All permissions must be enforced server-side.

Hiding a button is not authorization.

---

# 7. Organization model

Even though v1 has one organization, keep a simple organization abstraction.

Seed:

```text
Rabbit Bytes
```

Suggested Firestore documents:

```text
organizations/{organizationId}
users/{uid}
organizations/{organizationId}/members/{uid}
```

Example member document:

```ts
{
  uid: string;
  email: string;
  displayName?: string;
  role: "admin" | "member";
  status: "active" | "invited" | "disabled";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

No organization creation UI in v1.

---

# 8. Firestore usage

Firestore stores **configuration, metadata, credentials, and small operational logs only**.

Recommended collections:

```text
organizations/
users/
shopee_connections/
shopee_credentials/
oauth_states/
audit_logs/
api_logs/          (optional / bounded)
```

No performance warehouse.

---

# 9. Suggested Firestore models

## `shopee_connections/{connectionId}`

```ts
{
  organizationId: string;
  environment: "sandbox" | "production";

  shopId: string;
  merchantId?: string;
  mainAccountId?: string;

  shopName?: string;
  region?: string;
  currency?: string;

  status:
    | "pending"
    | "connected"
    | "authorization_expiring"
    | "reauthorization_required"
    | "disconnected"
    | "error";

  authorizationExpiresAt?: Timestamp;
  connectedAt: Timestamp;
  disconnectedAt?: Timestamp;

  lastApiSuccessAt?: Timestamp;
  lastApiErrorAt?: Timestamp;
  lastProviderRequestId?: string;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Create a deterministic lookup/index strategy for:

```text
organizationId + environment + shopId
```

Prevent duplicate active connections for the same shop/environment.

## `shopee_credentials/{connectionId}`

**Server-only collection. Browser clients must not read this.**

```ts
{
  accessToken: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };

  refreshToken: {
    ciphertext: string;
    iv: string;
    authTag: string;
  };

  accessTokenExpiresAt: Timestamp;
  refreshTokenExpiresAt?: Timestamp;

  tokenVersion: number;
  updatedAt: Timestamp;
}
```

Do not put tokens inside `shopee_connections`.

## `oauth_states/{state}`

Short-lived, one-time-use state for CSRF protection.

```ts
{
  userId: string;
  organizationId: string;
  environment: "sandbox" | "production";
  returnTo: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  consumedAt?: Timestamp;
}
```

Delete/expire aggressively.

## `audit_logs/{logId}`

Store only important operational actions:

- user invited
- role changed
- Shopee connection initiated
- shop connected
- shop reauthorized
- shop disconnected

Never store secrets.

## `api_logs/{logId}`

Optional and bounded.

Store safe diagnostics only:

```ts
{
  organizationId: string;
  connectionId: string;
  environment: "sandbox" | "production";
  provider: "shopee";
  endpointName: string;
  httpStatus?: number;
  providerErrorCode?: string;
  providerRequestId?: string;
  durationMs?: number;
  success: boolean;
  createdAt: Timestamp;
}
```

Do not store raw request URLs when they may contain sensitive query parameters.

Add retention cleanup if API logs are persisted.

---

# 10. Firestore Security Rules

The safest v1 model is:

- Browser uses Firebase Auth.
- Protected business data is primarily accessed through authenticated Next.js server routes.
- Credential collections are **never readable/writable from browser clients**.

Security Rules must deny browser access to:

```text
shopee_credentials
```

and any server-only OAuth state collection if the client does not need direct access.

Do not use permissive development rules such as:

```text
allow read, write: if true;
```

in staging or production.

Add Emulator/Rules tests where practical.

---

# 11. Firebase Admin SDK

All privileged operations use Firebase Admin SDK server-side.

Examples:

- verify session cookie
- manage invitations/users
- read/write Shopee credentials
- consume OAuth state
- rotate credentials
- write audit logs

Suggested modules:

```text
src/lib/firebase/admin.ts
src/lib/firebase/firestore.ts
```

Initialize Admin SDK once safely in server runtime.

Secrets belong in Vercel environment variables or another secure secret store.

---

# 12. Shopee environment isolation

Define:

```ts
type ShopeeEnvironment = "sandbox" | "production";
```

Create one config module:

```text
src/lib/shopee/config.ts
```

Do not scatter provider hosts/IDs throughout the app.

Example environment variables:

```env
APP_ENV=staging
NEXT_PUBLIC_APP_URL=https://your-stable-staging-domain.example

SHOPEE_ENV=sandbox
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_REDIRECT_URI=https://your-stable-staging-domain.example/api/shopee/callback

TOKEN_ENCRYPTION_KEY=

NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

SESSION_COOKIE_NAME=rb_session
SENTRY_DSN=
```

Production uses separate values:

```env
APP_ENV=production
SHOPEE_ENV=production
```

Requirements:

- Validate server env with Zod.
- Fail fast on missing required secrets.
- Never prefix private credentials with `NEXT_PUBLIC_`.
- Never silently fall back from Production to Sandbox.

---

# 13. Shopee authorization requirements

Use **current official Shopee Open Platform documentation** as the source of truth.

Project documentation reviewed for this implementation states that:

- seller authorization is required to call non-public shop-management APIs
- Seller In House System apps can initiate authorization from the Shopee Open Platform App page
- authorization is completed by seller/shop approval
- callback returns an authorization `code`
- shop-level authorization returns `shop_id`
- main-account flow may return `main_account_id`
- authorization code is one-time-use and currently has a short expiration window
- access token is short-lived
- refresh token is longer-lived
- refresh returns a new token pair
- redirect domain must match Shopee Console configuration when validation applies

Before production, re-check current official docs and current Shopee Console requirements.

---

# 14. Authorization callback

Route:

```text
GET /api/shopee/callback
```

Responsibilities:

1. Validate expected query params.
2. Validate/consume OAuth `state` when used by the authorization-link flow.
3. Verify current authenticated/admin context where applicable.
4. Exchange `code` immediately server-side.
5. Encrypt tokens.
6. Persist/update connection metadata.
7. Persist encrypted credential document.
8. Fetch safe shop metadata to validate the connection.
9. Write an audit log.
10. Redirect to a safe internal success page.

Do not render raw `code`, `access_token`, or `refresh_token` in browser JSON.

Do not accept arbitrary `returnTo` destinations.

---

# 15. OAuth state / CSRF

When the authorization-link mechanism supports `state`, use it.

Generate state with cryptographically secure random bytes.

State must be:

- unguessable
- short-lived
- tied to user/organization/environment
- one-time-use
- consumed transactionally

Reject:

- missing state when required
- mismatched state
- expired state
- replayed state

Do not use a static state string.

---

# 16. Shopee token exchange and refresh

Create:

```text
src/lib/shopee/tokens.ts
```

Responsibilities:

- exchange authorization code
- calculate token expiry
- encrypt credentials
- decrypt credentials server-side
- refresh token pair
- atomically replace token pair
- detect reauthorization requirement

Current documented token endpoints must be reverified before shipping.

Do not hardcode provider behavior from memory.

---

# 17. Credential encryption

Shopee access/refresh tokens must not be stored plaintext.

Use:

```text
AES-256-GCM
```

Store per secret:

```text
ciphertext
iv
authTag
```

The encryption key must:

- be 32 random bytes (or securely encoded equivalent)
- live only in secure server environment configuration
- never be stored in Firestore
- never be sent to the browser
- never be logged

Suggested module:

```text
src/lib/crypto/token-encryption.ts
```

Required tests:

- encrypt/decrypt round-trip
- randomized IV behavior
- tampered ciphertext/auth tag must fail

---

# 18. Token refresh concurrency

Because Shopee refresh tokens rotate, concurrent refresh calls for one shop must be prevented.

Use a **Firestore transaction + `tokenVersion` compare-and-swap** strategy.

Concept:

```text
read credential doc
      ↓
remember tokenVersion
      ↓
if refresh required, obtain refresh lock/lease or transaction marker
      ↓
refresh Shopee token
      ↓
transactionally verify expected tokenVersion
      ↓
write new encrypted access token
write new encrypted refresh token
increment tokenVersion
```

Do not let two requests overwrite one another with different refresh tokens.

A simple per-connection short-lived refresh lock document/field is acceptable if implemented safely.

---

# 19. Access-token health helper

Create one helper such as:

```ts
getValidShopeeAccessToken(connectionId)
```

Behavior:

1. server verifies user is authorized for connection
2. read connection + credential metadata
3. if access token has sufficient lifetime, decrypt and return it
4. if near expiry, refresh safely
5. atomically persist rotated token pair
6. return fresh access token
7. if refresh/authorization is no longer valid, mark connection `reauthorization_required`

Suggested pre-refresh threshold:

```text
< 30 minutes remaining
```

Make threshold configurable.

---

# 20. Shopee request signing

Create exactly one canonical signing module:

```text
src/lib/shopee/signature.ts
```

Use HMAC-SHA256 with Partner Key according to current Shopee documentation.

Current docs describe different base strings for public/shop/merchant APIs.

Do not duplicate signing logic in route handlers.

Requirements:

- Unix timestamp seconds
- lowercase hex signature
- exact API path
- server-only
- deterministic unit tests using fixed fixtures

---

# 21. Shopee client

Suggested structure:

```text
src/lib/shopee/
  auth.ts
  client.ts
  config.ts
  errors.ts
  signature.ts
  tokens.ts
  shop.ts
  ads/
    client.ts
    mapper.ts
    schemas.ts
    types.ts
```

The client handles:

- environment host
- signing
- common query parameters
- timeout
- response JSON parsing
- safe error normalization
- provider request ID
- retry classification
- Zod validation at trust boundaries

Create a safe error class:

```ts
class ShopeeApiError extends Error
```

Safe metadata only:

```ts
{
  endpointName: string;
  errorCode?: string;
  requestId?: string;
  httpStatus?: number;
  retryable: boolean;
}
```

Never attach tokens, Partner Key, authorization code, or sensitive raw URL.

---

# 22. Shopee Shop Ads integration — do not guess

This is critical.

**Codex must not invent Shopee Ads endpoints or response fields.**

Before implementing the Ads page/API:

1. Open the current official Shopee Open Platform documentation.
2. Identify the exact Shop Ads module/endpoints available to this app.
3. Verify Seller In House System permissions.
4. Verify shop-level vs merchant-level authentication.
5. Verify HTTP method and API path.
6. Verify date-range limits.
7. Verify pagination.
8. Verify rate limits if documented.
9. Verify attribution definitions.
10. Capture a redacted Sandbox response.
11. Document all findings in:

```text
docs/SHOPEE_ADS_API_NOTES.md
```

Only then implement mapper/types/UI.

If official Ads documentation cannot be accessed, stop that integration detail and document the blocker rather than fabricating an API.

---

# 23. Ads data behavior

Ads data is fetched live.

Suggested server route:

```text
GET /api/shopee/ads
```

or a typed server action if that is cleaner.

Input:

```text
connectionId
dateFrom
dateTo
optional campaign/entity filters
pagination params
```

Server flow:

```text
Verify Firebase session
      ↓
Verify organization membership
      ↓
Validate connection ownership
      ↓
Validate date range
      ↓
getValidShopeeAccessToken()
      ↓
Call Shopee Ads API
      ↓
Paginate/chunk only as official API requires
      ↓
Normalize response
      ↓
Return sanitized JSON
```

No Firestore write for performance rows.

---

# 24. Desired Ads reporting concepts

Expose only fields actually returned or safely derived from official source values.

Desired concepts where supported:

```text
shop
report date/date range
campaign/promoted entity ID
campaign/promoted entity name
type
status

impressions
clicks
spend
ctr
cpc
orders/conversions
sales/gmv
roas
currency
```

These are business requirements, not permission to invent Shopee field names.

If a metric is derived:

```text
CTR = clicks / impressions
CPC = spend / clicks
ROAS = attributed_sales / spend
```

Rules:

- divide-by-zero → `null`
- money handled carefully; do not persist float approximations
- do not mix currency
- do not mix attribution definitions
- document derived metrics

---

# 25. App routes

Suggested:

```text
src/app/
  (auth)/
    login/
    forgot-password/
    reset-password/

  (app)/
    layout.tsx
    dashboard/
    ads/
    connections/
    logs/
    settings/
      members/

  api/
    auth/
      session/
      logout/
    shopee/
      callback/
      ads/
      connection/
      reconnect/
      disconnect/
```

---

# 26. Navigation

Desktop sidebar using Tabler Icons.

```text
Overview      IconLayoutDashboard
Shopee Ads    IconChartBar
Connections   IconPlugConnected
API Logs      IconHistory
Members       IconUsers
Settings      IconSettings
```

On staging show a clear:

```text
SANDBOX
```

badge.

Never make Sandbox and Production visually ambiguous.

---

# 27. UI design direction

Build a clean internal operations/data application.

Prefer:

- compact sidebar
- readable tables
- practical filters
- clear connection status
- safe empty/error states
- modest charts only when they help
- desktop-first, responsive

Avoid:

- oversized marketing hero
- excessive gradients
- glassmorphism everywhere
- AI-style glow
- decorative animation
- emoji icons

Use shadcn components where appropriate.

---

# 28. `/dashboard`

Keep v1 simple because data is live.

Show persistent metadata:

- number of connected shops
- connection health
- shops requiring reauthorization

Optionally show a **live summary** for a selected shop/date range only after the Ads API is proven stable.

Do not automatically fan out expensive API calls across every shop on every dashboard load.

Avoid N-shop waterfall requests.

A safer v1 dashboard may show connection overview and link the user to the Ads page.

---

# 29. `/connections`

Show:

```text
Shop
Region
Environment
Connection Status
Authorization Status
Access Token Health
Last Successful API Call
Actions
```

Admin actions:

- Connect Shopee
- Reauthorize
- Disconnect
- Test connection

Member actions:

- View status
- Open Ads report

Never display raw token values.

---

# 30. `/ads`

This is the main v1 feature.

Filters:

- Shop
- Date range
- Campaign/entity if supported
- Status if supported

Default date range:

```text
Last 30 days
```

but clamp to official Shopee endpoint date limits.

Summary cards where supported:

- Spend
- Impressions
- Clicks
- CTR
- CPC
- Orders/Conversions
- Sales/GMV
- ROAS

Table:

- date / aggregation scope
- shop
- campaign/entity
- spend
- performance metrics

UI states:

- loading skeleton
- no-data state
- authorization-expired state
- provider-error state
- permission-missing state
- rate-limit state

Do not show stale Firestore performance data because none should exist.

---

# 31. API request lifecycle and retry

Read current Shopee rate-limit/error docs.

Do not invent fixed limits.

Retry only safe/idempotent read requests for:

- transient 5xx
- timeout
- temporary network error
- documented throttling

Use bounded exponential backoff + jitter.

Do not blindly retry:

- invalid signature
- invalid request parameters
- missing permission
- expired authorization

If access token is expired/near expiry, refresh once safely and retry the original request once.

Preserve provider `request_id` for diagnostics.

---

# 32. Disconnect / reauthorization

## Reauthorization

When provider indicates authorization is invalid/expired:

- mark connection `reauthorization_required`
- stop repeated failing live requests
- show clear admin action
- on successful reauthorization replace credential pair safely

## Disconnect

Admin only.

Flow:

1. confirmation dialog
2. revoke/cancel Shopee authorization using official flow if applicable
3. destroy stored encrypted credentials
4. mark connection disconnected
5. write audit log

Since no performance history is stored, there is no Ads warehouse to retain/delete.

---

# 33. Security requirements

Before production:

## Secrets

Never expose:

- Shopee Partner Key
- access token
- refresh token
- authorization code
- token encryption key
- Firebase Admin private key
- session cookie secret/material

## Client/server boundary

Provider credentials and signing must be server-only.

## Validation

Use Zod for:

- route inputs
- query params
- environment variables
- provider responses where practical

## Date ranges

Clamp user input to documented Shopee limits.

## Logging redaction

Redact keys resembling:

```text
token
secret
key
authorization
code
password
credential
```

## Headers

Configure appropriate production headers:

```text
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Content-Security-Policy
```

Test CSP against Firebase/Sentry requirements.

## No buyer PII

V1 must not intentionally request/store buyer PII.

If an Ads response unexpectedly contains PII, discard it during mapping and do not log/store it.

---

# 34. Logging strategy

Keep logs useful but small.

Persistent audit logs are appropriate.

API logs may be persisted with retention, but do not retain every successful API request forever.

Suggested retention:

```text
30–90 days
```

unless Rabbit Bytes requires otherwise.

Store provider request IDs on errors and selected diagnostics.

---

# 35. No scheduled Ads sync in v1

Because Ads performance is live-only:

```text
❌ no hourly Ads ingestion
❌ no cron performance sync
❌ no backfill worker
❌ no historical aggregation job
```

Background scheduling may be introduced later only for operational maintenance, such as:

- cleanup expired OAuth state
- cleanup old API logs
- proactive connection/token health checks

These are optional and not required for the first staging milestone.

Token refresh should primarily occur **on demand** before a live API request.

---

# 36. Performance considerations

Because every report request can hit Shopee:

- do not fan out across all shops by default
- require/select one shop for detailed report where practical
- enforce maximum date range
- debounce/filter UI interactions
- avoid duplicate requests from React rendering
- use `AbortController`/request cancellation where appropriate
- use server-side pagination/chunking
- expose loading state clearly

Do not optimize prematurely with a persistent warehouse.

---

# 37. Testing requirements

## Unit tests

Required:

- Shopee signing
- AES-GCM round-trip
- tamper detection
- env parser
- role checks
- session helper behavior
- token expiry calculation
- refresh decision
- token-version concurrency logic
- Ads mapper
- derived metrics
- log redaction

## Integration tests

Required:

- protected routes reject unauthenticated users
- admin/member behavior
- credential collection never exposed to client
- OAuth state validation
- state replay rejection
- callback input validation
- token persistence/rotation transaction
- live Ads endpoint validates shop ownership
- provider error sanitization

## E2E

At minimum:

```text
Login
→ Connections
→ authorized/connected Sandbox state
→ Shopee Ads
→ select shop/date
→ fetch live data
→ render table
```

A real Shopee Sandbox manual E2E remains required.

---

# 38. Development phases

## Phase 0 — foundation

Deliver:

- Next.js App Router
- TypeScript strict
- pnpm
- Tailwind
- shadcn
- `@tabler/icons-react`
- Firebase client/admin setup
- env validation
- lint/typecheck/test/build scripts
- README
- AGENTS.md
- docs folder

Acceptance:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

all pass.

---

## Phase 1 — Firebase Auth + app shell

Deliver:

- login
- logout
- password reset
- Firebase session cookie
- protected routes
- organization/member model
- admin/member RBAC
- invite-only flow
- sidebar/layout
- secure Firestore Rules

Acceptance:

- public signup unavailable
- unauthenticated users blocked
- role enforcement happens server-side
- browser cannot read Shopee credential collection

---

## Phase 2 — Shopee Sandbox connection

Deliver:

- Sandbox config
- Shopee authorization support
- callback
- authorization code exchange
- AES-256-GCM credential storage
- safe connection metadata
- token refresh
- reauthorization state
- canonical signer
- safe Shopee client
- test authenticated shop API call

Acceptance:

- Sandbox test shop authorizes successfully
- callback exchanges code server-side
- browser never receives token pair
- Firestore contains encrypted credential material only
- authenticated basic Shopee API succeeds
- token refresh/rotation tested

---

## Phase 3 — official Shopee Ads API discovery

Before implementation create:

```text
docs/SHOPEE_ADS_API_NOTES.md
```

Acceptance:

- exact official endpoints identified
- auth level confirmed
- permissions confirmed
- date limitations confirmed
- pagination confirmed
- returned metrics documented
- sample response redacted
- mapper design based on actual response

---

## Phase 4 — Live Ads API

Deliver:

- authenticated server Ads route/action
- Zod input validation
- live Shopee call
- pagination/date chunking as officially required
- response mapper
- retry/error handling
- no performance persistence

Acceptance:

- real Sandbox Ads request works
- Firestore receives no Ads reporting rows
- repeated request always derives data from provider/live request behavior
- errors expose request ID safely

---

## Phase 5 — Ads UI

Deliver:

- Ads page
- shop filter
- date range
- supported campaign/entity filters
- metric cards
- table
- useful chart if warranted
- loading/empty/error states

Acceptance:

- no mock metrics in production mode
- UI metrics reconcile with raw/redacted provider response
- no unnecessary all-shop fanout

---

## Phase 6 — logs + operations

Deliver:

- audit log
- API error diagnostics
- reauthorization UX
- disconnect flow
- log retention strategy

Acceptance:

- logs contain no secrets
- failed provider calls are diagnosable by request ID/error code

---

## Phase 7 — staging security review

Deliver:

- security headers
- secret audit
- Firestore Rules tests
- session-cookie review
- RBAC review
- callback/state replay tests
- credential leak scan
- dependency audit

Acceptance:

- no plaintext tokens
- no private secrets exposed to client bundles
- no permissive Firestore rules
- no secrets in Git history introduced by this project

---

## Phase 8 — Go-Live preparation

Create/update:

```text
docs/GO_LIVE_CHECKLIST.md
docs/SECURITY.md
docs/SHOPEE_INTEGRATION.md
```

Re-check the current Shopee Console and official documentation before submitting.

---

# 39. Production / Go-Live checklist

## Application readiness

- [ ] Stable production domain selected.
- [ ] HTTPS valid.
- [ ] Production Firebase project/config ready.
- [ ] Production Firestore Rules deployed.
- [ ] Production Firebase Admin credentials securely configured.
- [ ] Production Shopee Partner credentials configured only server-side.
- [ ] Sandbox credentials absent from production config.
- [ ] Live Redirect URL Domain configured correctly in Shopee Console.
- [ ] Login required.
- [ ] Public signup disabled.
- [ ] Session cookie hardened.
- [ ] Admin/member authorization tested.
- [ ] OAuth state protection tested where applicable.
- [ ] Access/refresh tokens encrypted at rest.
- [ ] Token rotation tested.
- [ ] Reauthorization tested.
- [ ] Disconnect/revoke tested.
- [ ] No buyer PII intentionally requested/stored.
- [ ] No Ads performance data stored in Firestore.
- [ ] Secrets absent from browser bundles.
- [ ] Secrets absent from logs.
- [ ] Security headers verified.
- [ ] Provider errors are sanitized.
- [ ] Shopee request IDs retained for diagnostics.
- [ ] Ads endpoint permissions are minimal and documented.
- [ ] Sandbox E2E passes.
- [ ] Ads numbers manually reconciled against Shopee UI where possible.

## Shopee Console readiness

Verify current requirements shown by Shopee at submission time:

- correct App category/type
- accurate application description
- Live Redirect URL Domain
- required API permissions only
- no unnecessary sensitive-data permissions
- screenshots/demo information if requested
- current Go-Live checklist/tasks
- any current security/compliance requirement shown for this app/account type

Do not assume the review form remains identical over time.

The current Shopee Console is authoritative.

---

# 40. Recommended repository structure

```text
.
├── AGENTS.md
├── RABBIT_BYTES_DATA_HUB_CODEX_BRIEF.md
├── README.md
├── docs/
│   ├── GO_LIVE_CHECKLIST.md
│   ├── SECURITY.md
│   ├── SHOPEE_ADS_API_NOTES.md
│   └── SHOPEE_INTEGRATION.md
├── firebase/
│   ├── firestore.rules
│   └── firestore.indexes.json
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (app)/
│   │   └── api/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── connections/
│   │   └── ads/
│   ├── lib/
│   │   ├── auth/
│   │   ├── crypto/
│   │   ├── env/
│   │   ├── firebase/
│   │   ├── logging/
│   │   └── shopee/
│   │       ├── ads/
│   │       ├── auth.ts
│   │       ├── client.ts
│   │       ├── config.ts
│   │       ├── errors.ts
│   │       ├── shop.ts
│   │       ├── signature.ts
│   │       └── tokens.ts
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

---

# 41. README requirements

README must explain:

1. project purpose
2. live-data architecture
3. why Ads performance is not persisted
4. local setup
5. Firebase project setup
6. Firebase Auth setup
7. Firestore Rules deployment
8. environment variables
9. Shopee Sandbox setup
10. Test Redirect URL Domain
11. Sandbox authorization flow
12. token encryption
13. token refresh behavior
14. how to test a basic Shopee API call
15. how to test Shop Ads live query
16. staging deployment
17. production deployment
18. tests
19. troubleshooting
20. Go-Live checklist

Never put real credentials in docs.

---

# 42. Code quality rules

- TypeScript strict
- avoid `any`
- use `unknown` + validation at external boundaries
- small route handlers
- provider logic stays under `lib/shopee`
- Firebase Admin logic stays server-side
- UI components do not know Partner Key/token details
- no giant service files
- no duplicated signing logic
- no duplicated token refresh logic
- no hardcoded credentials
- no production mock data
- comments explain *why*
- no unnecessary marketplace abstractions in v1

---

# 43. CI

GitHub Actions on PR:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not execute real Shopee API integration tests in normal public CI.

Real Sandbox tests should be manual or explicitly secured.

---

# 44. Git workflow

Codex must inspect Git status before changes.

Suggested:

```text
main          → production
staging       → stable Sandbox staging
feature/*     → implementation work / Vercel Preview
```

A simpler `main + feature/*` workflow is acceptable if a stable staging deployment still exists.

Do not use an ephemeral Preview URL as the registered Shopee redirect domain.

---

# 45. Definition of Done — staging

- [ ] Next.js app builds.
- [ ] Firebase Auth login works.
- [ ] Invite-only access works.
- [ ] Session-cookie auth protects server routes.
- [ ] Admin/member RBAC works.
- [ ] Firestore rules are restrictive.
- [ ] Credential collection is server-only.
- [ ] Shopee Sandbox shop can authorize.
- [ ] Callback exchanges authorization code server-side.
- [ ] Tokens stored encrypted.
- [ ] Token refresh/rotation works safely.
- [ ] Basic authenticated Shopee API call succeeds.
- [ ] Official Ads API notes are documented.
- [ ] Live Ads API request succeeds.
- [ ] Ads performance is **not** persisted in Firestore.
- [ ] Ads page renders live provider data.
- [ ] Errors are sanitized and include safe request ID diagnostics.
- [ ] No credentials appear in browser/logs.
- [ ] Tests pass.
- [ ] Lint/typecheck/build pass.
- [ ] Manual Sandbox E2E documented.

---

# 46. Definition of Done — Go-Live ready

- [ ] Stable production domain exists.
- [ ] Production Firebase config isolated.
- [ ] Production Shopee config isolated.
- [ ] Live Redirect URL Domain configured.
- [ ] Production secrets securely stored.
- [ ] No Sandbox secret leakage.
- [ ] No browser-readable provider secrets.
- [ ] Credential encryption active.
- [ ] Session/RBAC/Rules tests pass.
- [ ] Reauthorization/disconnect work.
- [ ] Live Ads read flow is proven.
- [ ] No performance warehouse exists accidentally.
- [ ] No buyer PII is intentionally requested/stored.
- [ ] Security docs complete.
- [ ] Shopee integration docs complete.
- [ ] Current Shopee Console Go-Live requirements reviewed line-by-line.

---

# 47. Codex execution order

Do not build everything in one uncontrolled pass.

Use this order:

```text
1. Inspect repository + Git status
2. Read AGENTS.md and this brief
3. Scaffold foundation
4. Add Firebase client/admin + env validation
5. Build Firebase Auth session-cookie flow
6. Add organization/member RBAC
7. Add restrictive Firestore Rules
8. Build Shopee Sandbox auth/sign/token/token-encryption layer
9. Prove a basic authenticated Shopee shop API call
10. Research/document official Shopee Ads API
11. Build live Ads server endpoint
12. Build Ads UI
13. Add audit/API diagnostics
14. Add reauthorization + disconnect
15. Security review
16. Staging Sandbox E2E
17. Prepare Production/Go-Live docs
```

At the end of each phase:

- run lint
- run typecheck
- run tests
- run build
- summarize changed files
- summarize manual Firebase/Shopee Console steps
- list external blockers

---

# 48. Final implementation principle

Build a **small, secure live connector**, not a warehouse.

The core truth for v1 is:

```text
Firestore = users + roles + connections + encrypted credentials + small logs
Shopee API = source of truth for Ads performance
```

Do not persist performance just because it is convenient.

Do not invent Shopee APIs.

Do not weaken credential security to make Sandbox testing easier.

A reliable live Sandbox integration that is ready for Shopee review is the goal.
