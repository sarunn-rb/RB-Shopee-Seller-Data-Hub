# Go-Live Checklist

This is a readiness ledger, not evidence of Shopee approval.

## Implemented locally

- [x] Required Next.js/Firebase/live-query architecture preserved.
- [x] Git repository initialized with tracked baseline.
- [x] Firebase session-cookie login and current-membership checks implemented.
- [x] Admin/member server-side RBAC and org/environment ownership implemented.
- [x] OAuth state binding, one-time consumption, token validation, encryption, and shop-info proof implemented.
- [x] Refresh lease/version design keeps provider HTTP outside transactions.
- [x] Seven requested Ads capabilities use verified paths/methods and action-specific schemas.
- [x] Ads pagination, date bounds, timeouts, cancellation, redaction, and no-persistence boundary implemented.
- [x] Deny-all browser Rules and TTL/index configuration added.
- [x] Security-critical unit tests added.

## Firebase staging actions

- [x] Firestore Rules emulator suite passed locally with `pnpm test:rules` on 2026-08-24.
- [ ] Create/confirm isolated staging Firebase project.
- [ ] Enable Email/Password Auth; disable public signup workflow.
- [ ] Bootstrap approved admin/member users and securely send first-password reset email.
- [ ] Deploy `firebase/firestore.rules` and `firebase/firestore.indexes.json` to the exact staging project.
- [ ] Confirm TTL policies for `oauth_states`, `shopee_api_logs`, and `audit_logs` are enabled.
- [ ] Confirm log composite index reaches Ready state.
- [ ] Configure Firebase Admin credentials only in secure server environment.
- [ ] Verify session-cookie Secure/HttpOnly/SameSite behavior and removed-user denial.

## Shopee Sandbox E2E

- [ ] Rotate the Test Partner Key exposed in supplied conversation content.
- [ ] Configure the stable HTTPS Test Redirect URL Domain/URI.
- [ ] Confirm the current Sandbox authorization hostname from an actual console-generated link.
- [ ] Complete login → connect → callback → encrypted storage → shop info.
- [ ] Capture a sanitized request ID for each of the seven Ads endpoints.
- [ ] Reconcile money units, attribution metrics, date bounds, and rows with Shopee UI.
- [ ] Resolve GMV Max one-month vs three-month documentation conflict using Sandbox evidence.
- [ ] Confirm campaign-ID practical page limit and full pagination.
- [ ] Force token refresh and verify single rotation/version increment under concurrency.
- [ ] Test permanent refresh failure separately from transient provider failure.
- [ ] Disconnect locally, cancel provider authorization in Shopee, then reconnect.
- [ ] Confirm Firestore has no Ads reporting/history collections or rows.
- [ ] Confirm logs contain no secrets.

## Vercel staging

- [ ] Configure isolated staging env values and stable callback origin.
- [ ] Deploy, wait for READY, and verify a live HTTPS response.
- [ ] Validate CSP, HSTS, clickjacking, referrer, and cache headers.
- [ ] Run authenticated staging E2E without exposing tokens in browser/network logs.

## Production and Shopee approval

- [ ] Re-review all current official hosts, endpoints, app permissions, rate limits, and Go-Live requirements.
- [ ] Create isolated production Firebase/Shopee configuration and encryption key.
- [ ] Configure production redirect URL and secrets.
- [ ] Repeat secure production smoke test with approved Rabbit Bytes shop.
- [ ] Verify cancellation/reauthorization operational runbook.
- [ ] Confirm no buyer PII is requested/stored.
- [ ] Obtain actual Shopee Go-Live approval.

## Current blockers

1. No real Sandbox authorization or Ads response/request ID has been captured in this hardening pass.
2. Shopee's current GMV Max date-range text conflicts with its error contract.
3. Sandbox authorization hostname needs confirmation from the actual console-generated flow.
4. Staging Firebase/TTL/index deployment and Vercel staging verification remain manual.
