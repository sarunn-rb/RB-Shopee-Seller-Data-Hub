# Security

## Phase 0 controls

- Firestore Rules deny all browser reads and writes.
- Firebase Admin is isolated in a server-only module.
- Private environment variables have no `NEXT_PUBLIC_` prefix.
- Environment validation prevents Sandbox/Production configuration mixing.
- Shopee credentials are not present in repository files.
- The UI contains no provider credentials or real Ads data.
- Lucide is not installed; UI icons use Tabler Icons.

## Planned controls before Sandbox E2E

- Firebase session cookies with Secure, HttpOnly, finite expiry, and appropriate SameSite settings.
- Server-side invite-only organization membership and admin/member RBAC.
- One-time transactionally consumed OAuth state with short TTL and safe internal `returnTo`.
- AES-256-GCM token encryption with unique random IVs and authenticated tamper failure.
- Transactional refresh rotation with `tokenVersion`/lease concurrency protection.
- Structured log redaction for secret-like keys.
- Provider error sanitization while preserving safe `request_id` diagnostics.
- Restrictive Rules/Emulator tests.
- Security headers validated against Firebase requirements.

## Secret handling

Never commit, log, display, or transmit Shopee Partner Key, access/refresh token, authorization code, token-encryption key, Firebase Admin private key, session cookies, passwords, or credential documents.

The Test API Partner Key visible in the supplied screenshot should be rotated in Shopee Console because it was exposed in conversation content. Do not reuse that exact key in committed files or documentation.

## Data boundary

Firestore may hold identity, organization/member metadata, sanitized connection metadata, encrypted credentials, OAuth state, audit logs, and bounded diagnostics. Shopee Ads performance is queried live and is not persisted as reporting history.
