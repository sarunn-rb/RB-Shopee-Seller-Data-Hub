# Rabbit Bytes Data Hub

Internal Rabbit Bytes application for connecting Rabbit Bytes-owned Shopee shops and querying Shopee Shop Ads performance live through Shopee Open Platform.

## Architecture

```text
Browser
→ authenticated Next.js server
→ Shopee Open API
→ normalize in memory
→ browser
```

Firestore stores identity, organization/member metadata, Shopee connection metadata, encrypted credentials, one-time OAuth state, audit logs, and small bounded diagnostics only. **Ads performance is never persisted as reporting history.** Shopee remains the source of truth.

## Current status

Phase 0 foundation is implemented:

- Next.js 16 App Router, React 19, strict TypeScript, pnpm, Tailwind CSS 4
- shadcn/ui foundation and Tabler Icons only
- responsive Sandbox app shell and safe empty-state routes
- Firebase client/Admin initialization boundaries
- Zod environment validation
- deny-by-default Firestore Rules
- Vitest and CI scripts
- Shopee authorization notes verified against the official guide dated 2026-07-24

Authentication, RBAC, Shopee callback/token exchange, live Ads calls, and production deployment are **not implemented yet**.

## Local setup

Requirements:

- Node.js 20+
- pnpm 10+
- a Firebase project for the target environment
- a Shopee Open Platform Sandbox app

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. Do not add real secrets to `.env.example` or commit `.env.local`.

## Environment variables

Public Firebase identifiers are the only browser-exposed values and must use the `NEXT_PUBLIC_` prefix. Shopee Partner Key, Firebase Admin private key, token-encryption key, and session material are server-only.

See [.env.example](.env.example) for the complete Phase 0 contract. Environment validation rejects:

- missing required values
- Sandbox credentials paired with `APP_ENV=production`
- Production Shopee credentials in local/staging
- callback URLs outside the configured application origin
- malformed token-encryption keys

## Firebase setup

1. Create separate Firebase projects for staging and production.
2. Enable Email/Password Authentication; do not create public signup UI.
3. Create a server service account for Firebase Admin.
4. Configure the client identifiers and server credentials in local/Vercel environment variables.
5. Review [firebase/firestore.rules](firebase/firestore.rules). Phase 0 denies all browser reads and writes.

Rules deployment is intentionally not performed by this phase.

## Shopee Sandbox setup

1. Use the Registered Business Seller / Seller In House System app.
2. Configure a stable HTTPS Test Redirect URL Domain in Shopee Console before staging authorization.
3. Keep the Partner Key server-only.
4. For local callback development, use a deliberate secure tunnel/domain strategy; do not register an ephemeral Vercel Preview URL as the stable callback domain.

The official authorization guide and verified lifecycle notes are summarized in [docs/SHOPEE_INTEGRATION.md](docs/SHOPEE_INTEGRATION.md). Shop Ads endpoint details remain blocked until the official Ads guide and a redacted Sandbox response are reviewed; see [docs/SHOPEE_ADS_API_NOTES.md](docs/SHOPEE_ADS_API_NOTES.md).

## Token security design

The planned implementation stores connection metadata separately from credentials and encrypts each access/refresh token with AES-256-GCM (`ciphertext`, `iv`, `authTag`). Refresh rotation will use Firestore transaction semantics and a token version/lease to prevent concurrent refresh races. There is no plaintext fallback.

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Real Shopee Sandbox tests must not run in normal public CI. They require an explicitly secured manual environment.

## Deployment

Vercel is the required host. Staging and production must use separate Firebase and Shopee configuration. Deployment is not part of Phase 0 and has not been performed.

Before staging or production, follow [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) and [docs/SECURITY.md](docs/SECURITY.md).

## Troubleshooting

- Env validation failure: compare `.env.local` with `.env.example`; never paste secret values into issues or logs.
- Firebase Admin private key parsing: preserve the full PEM value and escaped newlines in the environment variable.
- Shopee callback domain mismatch: the redirect URI origin must match both `NEXT_PUBLIC_APP_URL` and the domain configured in Shopee Console.
- Provider behavior unclear: stop and verify current official Shopee documentation; do not infer endpoints or fields.
