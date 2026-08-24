# Rabbit Bytes Data Hub

Internal Rabbit Bytes application for securely connecting Rabbit Bytes-owned Shopee shops and querying Shopee Ads performance live.

## Architecture and data boundary

```text
Browser
→ Firebase session-cookie authenticated Next.js server
→ Firebase Admin / Shopee Open API
→ Zod validation + in-memory normalization
→ browser
```

Firestore stores identity, organization membership, connection metadata, AES-256-GCM encrypted credentials, one-time OAuth state, audit logs, and bounded diagnostics. **Ads performance is never persisted.** Shopee remains the reporting source of truth.

## Current implementation status

Implemented in code:

- Next.js 16 App Router, React 19, strict TypeScript, pnpm, Tailwind, shadcn/ui, Tabler Icons
- Firebase email/password login → recent-auth check → Secure HttpOnly session cookie
- invite-only `admin` / `member` RBAC rechecked against Firestore on every server request
- Shopee native `state` authorization flow, one-time state consumption, token exchange, encrypted credential persistence, and shop-info validation
- refresh-token lease + `tokenVersion` rotation with provider HTTP outside Firestore transactions
- all seven requested live Ads capabilities with action-specific validation, response schemas, bounded requests, and complete pagination where documented
- canonical connection states, same-origin mutation checks, structured redacted logs, and TTL configuration
- deny-all browser Firestore Rules; business data is accessed only through authenticated server routes

Not yet verified:

- real Shopee Sandbox authorization/Ads request and request IDs
- Firebase staging runtime and deployed Rules/indexes/TTL policies
- Vercel staging or production deployment
- Shopee production credentials, production behavior, or Go-Live approval

See [Shopee integration](docs/SHOPEE_INTEGRATION.md), [Ads API notes](docs/SHOPEE_ADS_API_NOTES.md), [security](docs/SECURITY.md), and the [Go-Live checklist](docs/GO_LIVE_CHECKLIST.md).

## Local setup

Requirements: Node.js 20+, pnpm 10+, a Firebase project, and a Shopee Open Platform Sandbox app.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Do not commit `.env.local`. Public Firebase identifiers are the only browser-exposed environment values. Partner Key, Firebase Admin private key, encryption key, and session material are server-only.

## Bootstrap an invite-only admin

```bash
pnpm exec tsx scripts/bootstrap.ts admin@rabbitbytes.co
```

The script creates a Firebase Email/Password user with a cryptographically random setup credential that is never printed, then writes an active admin membership under `organizations/rabbit-bytes/members/{uid}`. Send a password-reset email from Firebase Console through an approved secure admin workflow.

For an existing email-only user created by an older bootstrap version, explicitly prepare its Email/Password provider first:

```bash
pnpm exec tsx scripts/bootstrap.ts admin@rabbitbytes.co --prepare-password-reset
```

The flag generates a new private random setup credential but never displays or stores it.

## Verification commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:rules
pnpm build
```

`pnpm test:rules` needs Java because the Firestore emulator is Java-based. Provider Sandbox E2E is deliberately separate from public CI and must run with secured credentials.

## Firebase configuration

Deploy the reviewed Rules and index/TTL configuration separately per environment:

```bash
pnpm exec firebase deploy --only firestore:rules,firestore:indexes --project <staging-project-id>
```

This repository does not deploy automatically. Review the target project before running the command.

## Shared Firebase, separate Vercel environments

Rabbit Bytes may use one Firebase project for both the Sandbox and Production Vercel applications. This is an application-level isolation model: the browser remains denied by Firestore Rules, and every server route must match the persisted connection's explicit `environment` to `SHOPEE_ENV`.

Create two Vercel projects from this repository:

| Vercel project | Required environment |
| --- | --- |
| Sandbox | `APP_ENV=staging`, `SHOPEE_ENV=sandbox` |
| Production | `APP_ENV=production`, `SHOPEE_ENV=production` |

Both projects use the same Firebase client and Admin project values. They must use different Shopee Partner credentials, redirect origins, session-cookie names, and AES-256-GCM `TOKEN_ENCRYPTION_KEY` values. Connection and credential document IDs are environment-namespaced (for example, `sandbox_shop_123` and `production_shop_123`), so the same shop ID never collides across environments.

Because both server deployments can access the same Firebase project, a compromised Firebase Admin credential affects both environments. Keep the credentials server-only, rotate them on suspected exposure, and do not allow connection documents without an explicit `environment` field.

## Shopee Sandbox setup

Configure a stable HTTPS callback in Shopee Console that exactly matches `SHOPEE_REDIRECT_URI`. Sandbox and production must use separate Shopee credentials, encryption keys, and host configuration. The app refuses mixed production/Sandbox environment settings.

## Troubleshooting

- Sign-in always fails: verify Email/Password Auth, recent login, and active membership subdocument.
- Callback fails: verify the exact callback URI and inspect sanitized API logs; raw provider errors are intentionally not shown in the URL.
- Connection requires reauthorization: refresh credentials were permanently rejected or expired; an admin must authorize again.
- Rules tests fail before starting: install a supported Java runtime, then rerun `pnpm test:rules`.
- Provider behavior differs from docs: stop and capture a redacted Sandbox response/request ID before changing schemas.
