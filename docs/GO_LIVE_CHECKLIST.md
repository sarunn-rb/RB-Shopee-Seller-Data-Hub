# Go-Live Checklist

This checklist tracks readiness only. It is not evidence of Shopee approval.

## Foundation

- [x] Next.js App Router and strict TypeScript scaffolded.
- [x] Tailwind, shadcn/ui, Tabler Icons, Firebase SDKs, and Zod installed.
- [x] Sandbox environment is visually explicit.
- [x] Firestore Rules start deny-by-default.
- [ ] Git repository initialized and baseline committed.

## Staging

- [ ] Stable HTTPS staging domain selected.
- [ ] Staging Firebase project configured.
- [ ] Email/password Auth enabled with invite-only access.
- [ ] Session-cookie auth and server-side RBAC verified.
- [ ] Firestore Rules and rules tests deployed/passing.
- [ ] Test Redirect URL Domain configured in Shopee Console.
- [ ] Shopee Sandbox authorization callback passes E2E.
- [ ] Access/refresh tokens stored encrypted only.
- [ ] Token rotation and concurrency tests pass.
- [ ] Basic authenticated Shopee API succeeds.
- [ ] Official Ads endpoint/permission/constraints documented.
- [ ] Live Ads request succeeds and reconciles with Shopee UI.
- [ ] Firestore contains no Ads performance rows.
- [ ] Logs contain no secrets.

## Production

- [ ] Stable production domain and HTTPS verified.
- [ ] Production Firebase project isolated from staging.
- [ ] Production Shopee credentials isolated from Sandbox.
- [ ] Live Redirect URL Domain configured.
- [ ] Production secrets configured only in secure server environment.
- [ ] Session cookies, CSP, HSTS, and other headers verified.
- [ ] Reauthorization and disconnect/revoke verified.
- [ ] Buyer PII is not intentionally requested or stored.
- [ ] Current Shopee Console Go-Live requirements reviewed line-by-line.
- [ ] Shopee has actually confirmed Go-Live approval.
