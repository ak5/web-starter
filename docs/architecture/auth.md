# Auth

This is the load-bearing document. The auth core is the platform's heart; the
shapes below are deliberate and mutually reinforcing. **Read this before changing
anything in `packages/api/src/routes/auth`, the middleware, or the schema's
identity tables.**

## Two identities, one token table

There are **two identity tables**, kept separate on purpose:

- `users` — the public app's accounts.
- `admin_users` — the admin portal's accounts.

There is **one `tokens` table** for every short-lived secret (email
verification, password reset, magic login, invite). It uses an **exclusive-arc**
constraint so each row belongs to exactly one identity:

```sql
CHECK ((user_id IS NOT NULL) + (admin_id IS NOT NULL) = 1)
```

A token is for a user **or** an admin, never both, never neither. The
discriminator is structural, not a string flag.

Provider auth tables (`auth_email`, the OAuth overlay's `auth_<provider>`) are
discriminated by **`subject_type` + `subject_id`** — the same row shape attaches
a credential to either identity table without duplicating columns.

## Pre-login carries role; post-login is unified

- **Pre-login** routes are split by role because there is no JWT yet to tell us
  who is asking: `/auth/login` vs `/auth/admin/login`, `/auth/forgot-password`
  vs `/auth/admin/forgot-password`.
- **Post-login** is **unified** — the JWT carries `type: 'user' | 'admin'`, so
  one set of routes (`/auth/me`, `/auth/logout`, `/auth/change-password`, …)
  serves both. The gate is `requireAuth(type?)`.

`requireAuth(type?)` does more than check the cookie. When a `type` is given it
**DB-checks the identity row** as the source of truth: a user with `deleted_at`
or `banned_at` (and no active impersonation) is rejected even with a valid,
unexpired JWT. Deletion and bans take effect immediately, not at token expiry.

## Scoped sub-routers — wrong calls don't compile

`app.ts` mounts **scoped sub-routers**. `@ak5/api` exports two types,
`WebApiType` and `AdminApiType`, each exposing only its own pre-login set plus
the shared post-login set. Because `@ak5/web` instantiates `hc<WebApiType>()`,
`api.auth.admin.login` is a **compile error** from the public app — the
type-only RPC boundary makes role confusion a build failure, not a runtime check.

## JWT & cookies

- HS256, secret `JWT_SECRET` (must match across all three workers).
- Carried in the `ak5_token` httpOnly cookie, 7-day max-age.
- `sub` is always a **public ID** (`u-…` / `a-…`), never an internal PK.
- Payload includes `type`, `recentAuthAt`, and (during impersonation)
  `impersonatedBy`.

## Recent-auth window

Sensitive actions (change password, change email, delete account) are wrapped in
`requireRecentAuth`, which requires `recentAuthAt` to be within **15 minutes**.
On failure it returns a structured `403 { code: 'recent_auth_required' }` the
frontend recognizes and surfaces as a re-auth prompt.

## Impersonation

An admin can act as a user for support:

1. The admin's own JWT is parked in a second cookie, `ak5_admin_token`.
2. A user JWT is issued into `ak5_token` carrying `impersonatedBy` (the admin's
   public ID).
3. Start and stop are written to `audit_log`.
4. `POST /auth/stop-impersonate` swaps the parked admin JWT back into
   `ak5_token` and clears the stash.

Because `impersonatedBy` rides in the token, `requireAuth` lets an impersonated
session through even if the target user is banned, while still attributing every
action to the acting admin.

## OAuth login is a removable overlay

OAuth login (Discord; others follow the same recipe) is a **removable overlay**.
The email + password core never imports from it, so the `auth-oauth` module —
API routes/lib **and** the web `OAuthLogin.svelte` button — can be deleted and
the core still authenticates. `audit:split` enforces that no core auth file
imports the overlay. See [platforms.md](platforms.md) for adding a provider.

## Platform auth endpoints

| Method | Route                         | Auth        | Purpose                      |
| ------ | ----------------------------- | ----------- | ---------------------------- |
| POST   | `/auth/register`              | pre-login   | Create a user account        |
| POST   | `/auth/login`                 | pre-login   | User login                   |
| POST   | `/auth/admin/login`           | pre-login   | Admin login                  |
| POST   | `/auth/forgot-password`       | pre-login   | Issue a user reset token     |
| POST   | `/auth/admin/forgot-password` | pre-login   | Issue an admin reset token   |
| GET    | `/auth/options`               | pre-login   | Enabled login methods        |
| POST   | `/auth/accept-invite`         | pre-login   | Set password from an invite  |
| POST   | `/auth/magic-login`           | pre-login   | Consume a magic-link token   |
| GET    | `/auth/me`                    | post-login  | Current identity             |
| POST   | `/auth/logout`                | post-login  | Clear the cookie             |
| POST   | `/auth/verify-email`          | post-login  | Consume a verification token |
| POST   | `/auth/resend-verification`   | post-login  | Re-send verification email   |
| POST   | `/auth/set-password`          | post-login  | First password set           |
| POST   | `/auth/change-password`       | recent-auth | Change password              |
| POST   | `/auth/request-reauth`        | post-login  | Refresh `recentAuthAt`       |
| POST   | `/auth/stop-impersonate`      | post-login  | End impersonation            |

## What NOT to change without re-reading this doc

- The **two identity tables** (`users`, `admin_users`).
- The **exclusive-arc** `tokens` shape.
- The **pre-login / post-login split** and the scoped sub-routers.
- The **cookie domain rules** (`COOKIE_ORIGIN` → Domain/Secure).
- `requireAuth` DB-checking `deleted_at` / `banned_at` as source of truth.

Each is load-bearing; changing one in isolation breaks an invariant elsewhere.

## Email delivery and retry

Password signup creates an unconfirmed account and returns its session even when
verification delivery fails (`verificationEmailSent: false`). The web app forwards
the cookie and opens `/account/verify`, with resend guidance on failure. Resend
and magic-link reauth await delivery and return `503 {error: "email_delivery_failed"}`
on rejection. A successful resend clears stale form errors. Signing in again
also retains access to verification resend; signup need not be repeated.

Public recovery for users and admins returns the same response for existing and
unknown accounts, even when background delivery fails. Admin invites commit the
account, token, and creation audit atomically before attempting delivery. A failed
invite returns `503 {error: "invitation_delivery_failed"}`; the account still exists
and the recipient can use password recovery to set their password.

Discord signup requires an already verified provider email and sends no separate
verification message. Its session issuance does not depend on email transport.
Delivery failures emit redacted events; see [email setup](../operations/email-sending.md).

## Native mobile sessions

The Svelte/Symbiote native app calls the same user endpoints through the Hono
client. It reads the JWT from `Set-Cookie`, persists it with Symbiote secure-store
(iOS Keychain / Android Keystore), and explicitly sends the session cookie on
authenticated calls. A 401 clears the saved session; temporary provider/network
failures keep it available for retry. Logout clears local storage even if the
server is unavailable. Unconfirmed signup remains signed in when verification
delivery fails and offers resend guidance; successful resend clears stale errors.
See [mobile setup](../../packages/mobile/README.md).

A failed native secure-storage removal leaves sign-out available for retry.
Successful sign-out and unauthorized sessions discard cached item views before
another account can sign in.
