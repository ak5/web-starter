# Security posture

The platform's defenses, top to bottom. Most are structural — enforced by the
schema, the type system, or `audit:split` — rather than by convention.

## Public IDs — no PK leak

Every entity carries a prefixed `public_id` (`u-`, `a-`, `t-`, …) generated with
`customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)`. Internal nanoid
PKs exist only for joins and **never** appear in JSON, URLs, JWTs, or cookies.
Random IDs make guessing harder and decouple the API surface from storage. They
are not authorization: every private resource still needs an ownership/role check. Generator: `packages/shared/src/public-id.ts`.

## Rate limiting

D1 stores one counter per action and caller. An atomic upsert admits at most the
configured number of requests in a fixed window starting with the first attempt.
Blocked requests neither increment the counter nor extend the window. A rejection
returns `429 {error: "rate_limited", retryAfter: 300}` with `Retry-After: 300`;
waiting that long is sufficient even if the window expires sooner.

Public login, registration, password recovery and invite acceptance use the caller
IP (`cf-connecting-ip`, falling back to `x-forwarded-for` for local/proxy traffic).
Only trust those headers from Cloudflare or a proxy you control. Signed-in email
verification, mail retries, reauthentication and password operations use the account
ID, so switching IPs does not reset their allowance. Actions have separate buckets;
the caps live beside their routes in `routes/auth/index.ts`. Scheduled cleanup
removes expired counters. Database errors fail closed rather than bypass the limit.

This is application-level abuse protection. Add edge protection for sustained
floods so rejected traffic does not exhaust the database. Development and trusted
PR previews share these counters along with their database.

## Validation backstop

Routes accepting JSON use `zValidator('json', …)` schemas; avatar uploads use a
multipart schema. Body-free mutations need no body parser. Validation runs before
handler logic and remains necessary when a caller bypasses the typed client.

## Cookie security

The auth cookie (`ak5_token`, admin stash `ak5_admin_token`) is:

- `httpOnly` — never readable from JS.
- `SameSite=Lax` — sent on top-level navigations, withheld on cross-site
  subrequests.
- `Secure` **in prod only** — dev is plain HTTP on `.ak5.localhost`.
- `Domain` derived from `COOKIE_ORIGIN` so it spans subdomains
  (api/web/admin share it); absent for bare `localhost`/IPv4.
- 7-day max-age.

Malformed cookie encodings and malformed JWT signatures are treated as invalid
credentials. Account session generations also invalidate cookies after password
changes and resets, even if a frontend refreshes the old cookie. They do not turn an otherwise valid request into a server error.

## No CSRF token

There is **no CSRF token** by design: `SameSite=Lax` plus the rule that **all
mutations are non-GET** (and Lax withholds the cookie on cross-site non-GET
subrequests) closes the classic CSRF vector without per-form tokens.

## Secret ownership

- `@ak5/api` owns **every data-touching secret**: OAuth provider
  secrets, encryption keys.
- `@ak5/web` / `@ak5/admin` hold `JWT_SECRET` to verify and refresh cookies.
  HS256 uses the same key for signing and verification: all three Workers are
  trusted token issuers. A compromised frontend Worker can mint credentials
  accepted by the API; it must be protected as part of the authentication boundary.
- `JWT_SECRET` is shared across all three workers. **Rotating it is a global
  logout** — every existing token fails verification at once.
- At-rest provider refresh tokens (OAuth overlay) are encrypted (AES-256-GCM).
  `TOKEN_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters; malformed keys
  fail before encryption or decryption. Generate one with `openssl rand -hex 32`.

## Content Security Policy

CSP is set **per app** (via each app's `vite.config.ts`), and
`securityHeadersHandle` in `@ak5/webui` applies the standard security headers
uniformly. Each persona can tighten its own policy.

## Impersonation safety

Admin impersonation parks the admin JWT in `ak5_admin_token`, issues a user JWT
carrying `impersonatedBy`, and writes `audit_log` rows on start and stop. API and
sync access require that admin to remain active. Other actions carry the actor ID
in their auth context but are not automatically audited. `stop-impersonate` swaps
the original admin token back. See [auth.md](auth.md).

## Password policy

Passwords are hashed with **argon2id**. A **minimum length** and a **strength
check** are enforced server-side at register / set / change time, alongside the
zod backstop — the client-side meter is convenience only, never the gate.

## Dependency security patches

CI runs `pnpm audit --audit-level=low` and the unit suite. The only advisory
exception is [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
for `deepmerge@4.3.1`. Its published version has no upstream fix. The starter
patches source, CommonJS and UMD builds to omit `__proto__` keys from both inputs,
preventing attacker-controlled prototypes on the returned objects.

The installed callers are Expo and React Native configuration and CLI tools.
`scripts/dependency-patches.test.mjs` exercises the installed dependency, including
null-prototype targets, nested null/primitive defaults, poisoned targets and arrays.
It also checks ordinary configuration merging. CI runs that regression before
the audit exception can qualify a build. This is a patched-package exception,
not an assertion that the published package is safe.

When an upstream fixed release is available, update the dependency and remove the
patch and exact advisory exception together. Keep the regression while the
dependency remains. No broader severity or registry-error exclusions are enabled.

## Avatar uploads and retention

Avatar uploads require a `.webp` filename, `image/webp` MIME type, a RIFF/WebP
signature and at most 5MB. R2 objects receive explicit `image/webp` HTTP metadata.
The Worker checks the signature; it does not decode or re-encode images. Add an
image-processing service if the application needs full decoding or normalization.

Uploaded avatars are public CDN objects. Replacing an avatar changes the database
reference; it does not remove the previous object. Account soft deletion revokes
credentials and tokens but retains the user row, domain data and uploaded objects.
A fork must define its retention/erasure policy and object cleanup before accepting
production data. An R2 expiry rule also expires currently referenced images, so it
must match the application's intended avatar lifetime.
