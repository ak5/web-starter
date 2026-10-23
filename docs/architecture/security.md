# Security posture

The platform's defenses, top to bottom. Most are structural — enforced by the
schema, the type system, or `audit:split` — rather than by convention.

## Public IDs — no PK leak

Every entity carries a prefixed `public_id` (`u-`, `a-`, `t-`, …) generated with
`customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)`. Internal sequential
PKs exist only for joins and **never** appear in JSON, URLs, JWTs, or cookies.
This removes ID-enumeration as an attack and decouples the API surface from the
storage layout. Generator: `packages/shared/src/public-id.ts`.

## Rate limiting

A **KV-backed sliding window per IP per action** guards pre-login routes. The KV
key is `ratelimit:<action>:<ip>` (IP from `cf-connecting-ip`, falling back to
`x-forwarded-for`), so different endpoints don't share a bucket. Over the cap
returns `429 { error: 'rate_limited' }`. Caps are per-action (login, register,
forgot-password each have their own window).

## Validation backstop

Every **mutating** route carries a `zValidator('json', …)` zod schema. Even if a
caller bypasses the typed client, the body is validated server-side before any
handler logic runs. The RPC types and the zod schemas describe the same shape —
the schema is the runtime backstop for the compile-time contract.

## Cookie security

The auth cookie (`ak5_token`, admin stash `ak5_admin_token`) is:

- `httpOnly` — never readable from JS.
- `SameSite=Lax` — sent on top-level navigations, withheld on cross-site
  subrequests.
- `Secure` **in prod only** — dev is plain HTTP on `.ak5.localhost`.
- `Domain` derived from `COOKIE_ORIGIN` so it spans subdomains
  (api/web/admin share it); absent for bare `localhost`/IPv4.
- 7-day max-age.

## No CSRF token

There is **no CSRF token** by design: `SameSite=Lax` plus the rule that **all
mutations are non-GET** (and Lax withholds the cookie on cross-site non-GET
subrequests) closes the classic CSRF vector without per-form tokens.

## Secret ownership

- `@ak5/api` owns **every data-touching secret**: OAuth provider
  secrets, encryption keys.
- `@ak5/web` / `@ak5/admin` hold **only `JWT_SECRET`**, and only to **verify**
  cookies — they can never write data even if compromised.
- `JWT_SECRET` is shared across all three workers. **Rotating it is a global
  logout** — every existing token fails verification at once.
- At-rest provider refresh tokens (OAuth overlay) are encrypted (AES-256-GCM).

## Content Security Policy

CSP is set **per app** (via each app's `vite.config.ts`), and
`securityHeadersHandle` in `@ak5/webui` applies the standard security headers
uniformly. Each persona can tighten its own policy.

## Impersonation safety

Admin impersonation parks the admin JWT in `ak5_admin_token`, issues a user JWT
carrying `impersonatedBy`, and writes `audit_log` rows on start and stop. Every
impersonated action is attributable to the acting admin; `stop-impersonate` swaps
the original admin token back. See [auth.md](auth.md).

## Password policy

Passwords are hashed with **argon2id**. A **minimum length** and a **strength
check** are enforced server-side at register / set / change time, alongside the
zod backstop — the client-side meter is convenience only, never the gate.
