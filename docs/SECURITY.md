# Security

## Implemented controls

- Firebase ID token is verified with revocation checking and `auth_time <= 5 minutes` before a 14-day session cookie is minted.
- Session cookie is HttpOnly, finite, SameSite=Lax, and Secure in staging/production.
- Every protected request rechecks active Rabbit Bytes membership; removed/disabled users cannot rely on an old session.
- Server-side roles enforce admin mutations and member read/reporting access. Connection routes verify organization and environment ownership.
- Session-cookie mutations require an exact configured Origin.
- Firestore browser Rules deny all business-data reads/writes; Firebase Admin remains server-only.
- OAuth state is random, user/org/environment-bound, short-lived, one-time, transactionally consumed, and TTL-cleaned.
- Tokens are validated before AES-256-GCM encryption; ciphertext, IV, and auth tag are stored separately from connection metadata.
- Refresh provider HTTP never runs inside a Firestore transaction. Lease/version transactions prevent rotating-token races.
- Provider requests use timeouts, `cache: no-store`, typed errors, schema validation, bounded safe retries, and safe `request_id` diagnostics.
- Recursive logging sanitizes objects, arrays, messages, circular data, and secret-like keys. Logs/audits have 30-day TTL fields.
- Login/callback UI receives fixed generic application codes, not Firebase exceptions, raw provider errors, codes, or tokens.
- Bootstrap creates no predictable/shared password and prints no password/reset link.

## RBAC

| Capability | Admin | Member |
|---|---:|---:|
| Query live Ads / view reporting | yes | yes |
| View safe connection metadata / diagnostics | yes | yes |
| Connect / reauthorize / disconnect / delete | yes | no |
| Manage members | yes | no |

UI visibility is convenience only; API/server checks are authoritative.

## Data retention and privacy

Ads performance is never persisted. Credential documents are never returned to the browser. OAuth state, Shopee diagnostics, and audit logs carry `expiresAt`; Firestore TTL is configured for eventual deletion. No V1 endpoint intentionally requests buyer PII, and response schemas strip unexpected Ads row fields.

## Required operational follow-up

- Rotate the Test Partner Key shown in the user-supplied screenshot because it was exposed in conversation content.
- Deploy Rules, composite indexes, and TTL overrides independently to staging/production.
- Configure separate environment credentials and encryption keys; never copy Sandbox token documents into production.
- Re-run the emulator Rules suite in the deployment/CI environment; it passed locally on 2026-08-24 after Java was installed.
- Validate CSP/HSTS/security headers on the actual staging domain.
- Review Firebase Auth users and membership subdocuments; disable both when removing access.
- Verify TTL policies appear enabled in Firebase Console and monitor deletion lag (TTL deletion is not immediate).

## Incident rule

Never commit, display, log, or transmit Partner Key, authorization code, tokens, Firebase Admin private key, encryption key, session cookies, passwords, credential documents, or sensitive setup links. If exposure is suspected, rotate/revoke the affected credential and review sanitized audit/API logs.
