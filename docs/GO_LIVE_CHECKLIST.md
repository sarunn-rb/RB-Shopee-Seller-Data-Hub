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
- [x] Confirm the shared Firebase project strategy: Vercel Sandbox and Production deployments are separated by explicit connection environment, Partner credentials, redirect origins, session-cookie names, and encryption keys.
- [ ] Enable Email/Password Auth; disable public signup workflow.
- [ ] Bootstrap approved admin/member users and securely send first-password reset email.
- [ ] Deploy `firebase/firestore.rules` and `firebase/firestore.indexes.json` to the shared Firebase project.
- [ ] Confirm TTL policies for `oauth_states`, `shopee_api_logs`, and `audit_logs` are enabled.
- [ ] Confirm log composite index reaches Ready state.
- [ ] Configure Firebase Admin credentials only in secure server environment.
- [ ] Verify session-cookie Secure/HttpOnly/SameSite behavior and removed-user denial.

## Shopee Sandbox E2E

- [ ] Rotate the Test Partner Key exposed in supplied conversation content.
- [ ] Configure the stable HTTPS Test Redirect URL Domain/URI.
- [x] Confirmed Sandbox authorization host from this app's Console-generated link: `open.sandbox.test-stable.shopee.com` (2026-08-24).
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

- [ ] Create a second Vercel project for Sandbox from the same GitHub repository and configure its stable callback origin.
- [ ] Configure the existing production Vercel project with the future Live callback origin only after Shopee issues Live Partner credentials.
- [ ] Set different `TOKEN_ENCRYPTION_KEY` and session-cookie values in the two Vercel projects; Firebase client/Admin values remain shared.
- [ ] Deploy, wait for READY, and verify a live HTTPS response.
- [ ] Validate CSP, HSTS, clickjacking, referrer, and cache headers.
- [ ] Run authenticated staging E2E without exposing tokens in browser/network logs.

## Production and Shopee approval

- [ ] Re-review all current official hosts, endpoints, app permissions, rate limits, and Go-Live requirements.
- [ ] Configure Production Shopee credentials and a distinct production encryption key in the Production Vercel project.
- [ ] Configure production redirect URL and secrets.
- [ ] Repeat secure production smoke test with approved Rabbit Bytes shop.
- [ ] Verify cancellation/reauthorization operational runbook.
- [ ] Confirm no buyer PII is requested/stored.
- [ ] Obtain actual Shopee Go-Live approval.

## Current blockers

1. Test Partner Key that was exposed outside the secure environment must be rotated before further Sandbox testing.
2. Reauthorize the Sandbox shop after the flat `get_shop_info` response handling deployment, then capture a sanitized Ads request ID.
3. Firestore TTL policies cannot be enabled until Firebase billing is enabled; the composite API-log index is Ready.
4. Create and configure the second Vercel Sandbox project, including its own Shopee redirect origin and secrets.
5. Confirm whether Shopee requires a fixed outbound IP address when IP allowlisting is disabled. Vercel Hobby has dynamic outbound IPs.
