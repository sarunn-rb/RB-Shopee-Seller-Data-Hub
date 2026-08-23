# AGENTS.md — Rabbit Bytes Data Hub

## Mission

You are working on **Rabbit Bytes Data Hub**, an internal Rabbit Bytes application that connects Rabbit Bytes-owned Shopee shops through Shopee Open Platform and queries **Shopee Shop Ads performance live**.

The immediate path is:

```text
Sandbox staging
→ secure live Shopee Ads query
→ staging E2E
→ production hardening
→ Shopee Go-Live readiness
```

This project is currently a **Registered Business Seller / Seller In House System** implementation, not a public multi-seller SaaS.

---

## First actions

Before modifying code:

1. Read this file completely.
2. Read `RABBIT_BYTES_DATA_HUB_CODEX_BRIEF.md`.
3. Read `README.md` if present.
4. Inspect the repository structure.
5. Inspect existing tests.
6. Run `git status`.
7. Preserve unrelated user work.
8. If a Shopee behavior is unclear, verify current official Shopee documentation instead of guessing.

---

# Non-negotiable architecture rule

**Do not persist Shopee Ads performance data in Firestore.**

Firestore is for:

```text
users
organization/member metadata
Shopee connection metadata
encrypted Shopee credentials
OAuth state
audit logs
small bounded API diagnostics
```

Shopee is the source of truth for performance.

Reporting flow:

```text
Browser
→ authenticated Next.js server
→ Shopee Open API
→ normalize in memory
→ browser
```

Do not create historical reporting collections unless the user explicitly changes the product requirement later.

---

# Required stack

Use:

- Next.js App Router
- React
- TypeScript (`strict: true`)
- pnpm
- Tailwind CSS
- shadcn/ui
- `@tabler/icons-react`
- Firebase Authentication
- Cloud Firestore
- Firebase Admin SDK
- Vercel
- Zod

Optional:

- Sentry

Do not replace the required stack without a concrete reason and explicit approval.

---

# Icons

Use **Tabler Icons** from:

```text
@tabler/icons-react
```

Rules:

- no Lucide
- no emoji as interface icons
- no icon font
- avoid custom SVGs when Tabler has an equivalent
- official brand assets are acceptable for provider branding
- keep icon size and stroke consistent

---

# V1 scope

V1 includes:

- Firebase login
- invite-only users
- admin/member roles
- Rabbit Bytes organization
- multi-shop Shopee connections
- Sandbox/Production separation
- Shopee authorization callback
- authorization code exchange
- encrypted access/refresh token storage
- token refresh/rotation
- live Shopee Shop Ads read API
- Ads dashboard/table
- connection health
- reauthorization
- disconnect/revoke
- audit/API diagnostics
- Go-Live documentation

V1 excludes:

- Ads performance storage
- Ads scheduled ingestion
- Orders
- Products
- Finance
- buyer PII
- CRM
- Lazada
- TikTok Shop
- public signup
- billing
- public seller onboarding
- Ads write/edit APIs

Do not expand scope without explicit instruction.

---

# Firebase Auth session model

Prefer Firebase session cookies for protected server routes.

Expected flow:

```text
Firebase client login
→ ID token
→ POST /api/auth/session
→ Firebase Admin verifies ID token
→ create Secure HttpOnly session cookie
→ server verifies session cookie
```

Do not rely only on a client token for server authorization.

On logout:

- clear server session cookie
- sign out client state

All privileged operations must verify the server session.

---

# RBAC

Roles:

```text
admin
member
```

Admin can:

- connect Shopee
- reauthorize
- disconnect
- manage members
- view reporting/logs

Member can:

- view reporting
- view connections
- query Ads
- view safe diagnostics

Enforce permissions server-side.

UI visibility is not authorization.

---

# Firestore rules

Never deploy permissive rules.

Credential documents must not be browser-readable.

Prefer privileged server access through Firebase Admin SDK for:

- Shopee credentials
- OAuth state
- member administration
- audit log writes

If browser access to business metadata is not required, deny it and route through the authenticated server layer.

Do not weaken rules to fix UI bugs.

---

# Firebase Admin SDK

Admin SDK is server-only.

Never import it into client components.

Keep initialization under:

```text
src/lib/firebase/admin.ts
```

Never expose:

- Admin private key
- service credentials
- privileged Firestore operations

through client code.

---

# Shopee integration rule

**Never invent Shopee API details.**

Current official Shopee Open Platform documentation and current Shopee Console are authoritative.

Before implementing an endpoint, confirm:

- host
- path
- method
- auth level
- sign base string
- permission
- request params
- date constraints
- pagination
- rate limit
- response fields
- error behavior

Especially for Shop Ads, update:

```text
docs/SHOPEE_ADS_API_NOTES.md
```

before finalizing the mapper/UI.

If docs cannot be verified:

- stop that provider-specific detail
- record the blocker
- do not fabricate an endpoint

---

# Shopee auth facts to preserve

Project documentation reviewed in August 2026 describes:

- seller authorization for non-public shop APIs
- authorization callback returning `code`
- shop authorization returning `shop_id`
- main-account authorization potentially returning `main_account_id`
- one-time authorization code
- short-lived access token
- longer-lived refresh token
- refresh token rotation
- redirect-domain validation

Reverify exact lifetimes/endpoints before production.

Do not casually change token lifecycle assumptions without checking the provider docs.

---

# Shopee authorization callback

The callback must:

1. validate query parameters
2. validate and consume `state` when used
3. exchange code immediately server-side
4. encrypt credential pair
5. persist connection metadata
6. persist credential document separately
7. validate connection with safe provider call
8. audit the operation
9. redirect internally

Never return raw `code`, `access_token`, or `refresh_token` to the browser.

---

# OAuth state / CSRF

Where the flow supports `state`:

- use cryptographically secure random state
- tie it to user/org/environment
- short TTL
- one-time consume
- reject replay
- allow only safe internal `returnTo`

Never use a static state value.

---

# Secrets — mandatory rules

Never commit, log, or expose:

- Shopee Partner Key
- access token
- refresh token
- authorization code
- AES encryption key
- Firebase Admin private key
- session cookies
- passwords

Never put these in:

- React props
- browser JSON
- client env variables
- analytics events
- error UI
- Firestore API logs
- screenshots committed to Git

---

# Credential encryption

Shopee token pair must be encrypted server-side before Firestore persistence.

Use:

```text
AES-256-GCM
```

Persist:

```text
ciphertext
iv
authTag
```

The encryption key remains outside Firestore in secure environment configuration.

No plaintext fallback is allowed.

---

# Token storage model

Keep connection metadata separate from credential data.

Recommended:

```text
shopee_connections/{connectionId}
shopee_credentials/{connectionId}
```

The browser may receive sanitized connection metadata.

The browser must never receive the credential document.

---

# Token refresh

Implement one central helper, for example:

```ts
getValidShopeeAccessToken(connectionId)
```

It must:

- validate connection access
- inspect expiry
- refresh early when necessary
- rotate both access and refresh tokens
- persist new pair atomically
- mark reauthorization-required when necessary

Do not duplicate refresh logic in Ads routes.

---

# Token refresh concurrency

Shopee refresh tokens rotate, so prevent concurrent refresh races.

Use Firestore transaction semantics with `tokenVersion` and/or a short-lived refresh lock.

Do not let two requests persist different refreshed token pairs over each other.

Add tests for the concurrency strategy.

---

# Shopee request signing

Use one canonical module only:

```text
src/lib/shopee/signature.ts
```

Never duplicate HMAC logic.

Signing is server-only.

Add deterministic unit tests with fixed inputs.

---

# Provider client

Provider HTTP behavior stays under:

```text
src/lib/shopee/
```

Suggested:

```text
auth.ts
client.ts
config.ts
errors.ts
shop.ts
signature.ts
tokens.ts
ads/
```

The UI must not assemble signed Shopee URLs itself.

Normalize provider errors into a safe typed error.

Keep Shopee `request_id` for diagnostics.

Do not attach secrets to errors.

---

# Live Ads rule

Ads data is queried on demand.

Do not create:

```text
ads_daily
ads_history
campaign_history
ads_snapshots
scheduled_ads_sync
ads_backfill
```

Do not write Ads rows to Firestore.

Do not add cron-based performance ingestion.

If short-lived caching is ever added, it requires explicit justification and must not become persistent reporting storage.

---

# Ads implementation process

Before coding Ads mapping:

1. verify official endpoint
2. verify permission
3. verify auth level
4. verify date limits
5. verify pagination
6. obtain Sandbox response
7. redact secrets
8. document response
9. define Zod schema
10. define UI mapper
11. test mapper with fixture

Business metric names are not proof of provider field names.

---

# Live Ads endpoint

Server-side flow should be:

```text
verify Firebase session
→ verify membership
→ verify connection ownership
→ validate date/filter input
→ obtain valid Shopee token
→ call Shopee Ads API
→ paginate/chunk as documented
→ normalize
→ return sanitized JSON
```

Do not persist the response as reporting history.

---

# Avoid provider-request explosions

Because reports are live:

- do not query every shop by default
- do not fire duplicate requests on React rerenders
- debounce filters where useful
- require bounded date ranges
- respect provider pagination
- cancel obsolete browser requests when possible
- do not auto-refresh aggressively

Do not add a data warehouse as a workaround without explicit product approval.

---

# Retry rules

Retry only safe read operations for transient failures.

Use bounded exponential backoff + jitter.

Do not endlessly retry:

- invalid signature
- permission denied
- invalid input
- expired authorization

If token expiry is the issue:

- refresh safely once
- retry original request once

Keep provider request IDs.

---

# Logging

Logs must be structured and redacted.

Safe fields:

```text
event
environment
organizationId
connectionId
shopId
endpointName
httpStatus
providerRequestId
providerErrorCode
durationMs
```

Never log values whose key or meaning resembles:

```text
token
secret
key
authorization
code
password
credential
```

Persistent API logs must have retention/cleanup.

---

# No buyer PII

V1 must not intentionally request or store buyer PII.

If an unexpected provider response contains PII:

- discard during mapping
- do not persist
- do not log
- document the finding

---

# UI conventions

Use Tailwind + shadcn + Tabler Icons.

Style:

- compact internal B2B app
- clear tables
- practical filters
- readable status badges
- useful empty states
- responsive

Avoid:

- oversized hero sections
- excessive gradients
- glassmorphism everywhere
- fake AI glow
- decorative animation
- emoji icons

Staging must visibly show `SANDBOX`.

---

# Main routes

Recommended:

```text
/login
/forgot-password
/reset-password
/dashboard
/ads
/connections
/logs
/settings/members
```

API routes may include:

```text
/api/auth/session
/api/auth/logout
/api/shopee/callback
/api/shopee/ads
/api/shopee/connection
/api/shopee/reconnect
/api/shopee/disconnect
```

---

# Ads page

Main v1 feature.

Support only filters/metrics the official API can support.

Expected business filters:

- shop
- date range
- campaign/entity
- status if available

Default date range can be Last 30 Days but must be clamped to provider constraints.

Required UI states:

- loading
- no data
- authorization expired
- permission error
- provider error
- throttled/rate-limited

Do not fake values.

---

# Disconnect

Admin only.

On disconnect:

- confirm action
- revoke/cancel authorization using official Shopee behavior if applicable
- destroy encrypted credential document
- mark connection disconnected
- write audit log

There is no Ads history to delete.

---

# Firestore data rules

Use Firestore only where it is a good fit.

Keep documents small.

Avoid unbounded arrays.

Use server timestamps.

Add indexes intentionally.

No reporting-denormalization scheme is needed because performance is not stored.

---

# TypeScript standards

- `strict: true`
- avoid `any`
- prefer `unknown` + Zod
- explicit provider types
- no careless non-null assertions
- no `@ts-ignore` unless exceptional and documented

---

# Tests

Before substantial work is complete, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Provider changes require relevant unit/integration tests.

At minimum test:

- signing
- encryption
- tamper failure
- env parsing
- role checks
- session verification
- token expiry
- token rotation
- refresh race handling
- OAuth state replay
- Ads mapper
- log redaction

---

# Git behavior

Before changes:

```bash
git status
```

Do not reset/clean/overwrite unrelated user work.

Do not commit `.env.local` or secrets.

Prefer coherent commits such as:

```text
feat(auth): add Firebase session-cookie login
feat(shopee): implement sandbox token exchange
feat(shopee): encrypt and rotate shop credentials
feat(ads): add live Shopee Ads reporting endpoint
fix(shopee): prevent concurrent refresh token races
docs(shopee): add go-live checklist
```

---

# Phase discipline

Work in this order unless already completed:

```text
1. foundation
2. Firebase Auth + session cookie
3. RBAC + Firestore Rules
4. Shopee Sandbox connection
5. token encryption + rotation
6. basic authenticated Shopee API proof
7. official Ads API research
8. live Ads endpoint
9. Ads UI
10. logs + reauthorization/disconnect
11. security review
12. Sandbox E2E
13. Go-Live docs
```

Do not introduce background Ads ingestion.

---

# Documentation to maintain

Keep these current:

```text
README.md
docs/SHOPEE_INTEGRATION.md
docs/SHOPEE_ADS_API_NOTES.md
docs/SECURITY.md
docs/GO_LIVE_CHECKLIST.md
```

If implementation behavior changes, update docs in the same change.

---

# Completion report

At the end of each substantial phase report:

1. what changed
2. files changed
3. Firebase config/rules/index changes
4. tests run and results
5. manual Firebase Console steps
6. manual Shopee Console steps
7. unresolved Shopee/provider blockers

Do not claim Go-Live approval unless Shopee actually confirms it.

---

# Final principle

The application is a **secure live connector**, not an analytics warehouse.

Remember:

```text
Firestore = identity + metadata + encrypted credentials + small operational logs
Shopee Open API = Ads performance source of truth
```

Do not persist performance because it is easier.

Do not guess provider behavior.

Do not weaken security for a demo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
