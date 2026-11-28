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
discriminator is structural, not a string flag. Verification PINs and re-auth
links are consumed atomically for the authenticated identity only. A mismatch
does not consume another account’s token. Password reset links identify their
account by the bearer secret.

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

`requireAuth(type?)` does more than check the cookie. It always
**DB-checks the identity row** as the source of truth: a user with `deleted_at`
or `banned_at` (and no active impersonation) is rejected even with a valid,
unexpired JWT. Deletion and bans take effect immediately, not at token expiry. Logout remains
available to clear cookies even when the session is invalid or the account is
inactive.

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
  `impersonatedBy`. Verification validates the HS256 header, claim types and
  timestamps; expiry is exclusive (a token expires at `exp`, not one second later).

## Session revocation

Each user and admin has a `session_version` in D1, starting at zero. JWTs carry
that generation as `sessionVersion`; refresh preserves it. The API and notes sync
reject a generation that no longer matches. OAuth sign-in reads the current
version when issuing a new session.

Setting or changing a password, including reset/invite completion, commits the
credential write, generation increment and deletion of outstanding one-time tokens
in one D1 batch. The response supplies a replacement cookie for the caller; other
sessions must sign in again. An impersonation cookie records both the user and
acting admin generations, so either account's password change revokes it.

Web and admin verify cookie signatures locally, then validate the session through
`GET /auth/me` before accepting or refreshing it. Deployed frontends use their API
service binding. A 401/403 clears rejected cookies and allows login; a service
failure shows an error without clearing a valid cookie. Native clears rejected
sessions on its next API request. Offline local data cannot be remotely erased;
see [local-first notes](local-first.md#offline-behavior-and-device-data).

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

The API checks that the acting admin is still active on each impersonated request,
including notes sync. Deleting that admin revokes their impersonation access.
`requireAuth` lets an active admin inspect a banned target; notes sync still rejects
banned users. Start and stop are audited. Other actions carry `impersonatedBy` in
the auth context but are not automatically written to the audit log.

## OAuth login is a removable overlay

OAuth login (Discord; others follow the same recipe) is a **removable overlay**.
The email + password core never imports from it, so the `auth-oauth` module —
API routes/lib **and** the web `OAuthLogin.tsx` button — can be deleted and
the core still authenticates. `audit:split` enforces that no core auth file
imports the overlay. See [platforms.md](platforms.md) for adding a provider.

## Signup policies

The starter creates accounts without recording agreement to policies. Policy text
and its presentation belong to the application using the starter. Before accepting
real users, publish the policies that describe your product and data handling, then
implement any required acknowledgement consistently in website, native and OAuth
signup. Never send an automatic `true` in place of a user's action.

The nullable `terms_accepted_at`, `terms_version`, `privacy_version` and
`acceptable_use_version` columns can hold the versions actually shown to a user.
Starter signup leaves them null. Include the acknowledgement and account creation
in the same transaction when adding that flow.

Discord assigns a username with a public-ID suffix so a provider handle cannot
collide with a password account. Email is normalized and checked against active
users, including invited accounts. Connecting Discord while signed in requires
recent authentication and rejects support impersonation; the callback returns to
`/account/password` with a visible result. Password login remains available after
connecting.

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
| POST   | `/auth/magic-login`           | post-login  | Consume a magic-link token   |
| GET    | `/auth/me`                    | post-login  | Current identity             |
| POST   | `/auth/logout`                | public      | Clear the cookie             |
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
unknown accounts, even when background delivery fails. From Users, admins can email invitations to
regular users or other admins. Copyable links are available for regular users. Both expire after seven days and
can be redeemed once to set a password. An emailed invite verifies the address
on redemption. A copied link permits password sign-in and leaves the address
unverified. Existing emailed links retain their verification behavior.

Email invitations require a configured sender and delivery binding before the
account is created. Admin invites commit the
account, token, and creation audit atomically before attempting delivery. A failed
invite returns `503 {error: "invitation_delivery_failed"}`; the account still exists
and the recipient can use password recovery to set their password.

Discord signup requires an already verified provider email and sends no separate
verification message. Its session issuance does not depend on email transport.
Delivery failures emit redacted events; see [email setup](../operations/email-sending.md).

## Native mobile sessions

The React Native app calls the same user endpoints through the Hono client.
It reads the JWT from `Set-Cookie`, persists it with Expo SecureStore
(iOS Keychain / Android Keystore), and explicitly sends the session cookie on
authenticated calls. A 401 clears the saved session; temporary provider/network
failures keep it available for retry. Logout clears local storage even if the
server is unavailable. Unconfirmed signup remains signed in when verification
delivery fails and offers resend guidance; successful resend clears stale errors.
See [mobile setup](../../packages/mobile/README.md).

A failed native secure-storage removal leaves sign-out available for retry.
Successful sign-out and unauthorized sessions discard cached item views before
another account can sign in.

## Local-first notes

Sync checks the session and active user on every HTTP push/pull and restricts
access to that user's exact notes store. Native offline restore can use a securely
cached viewer after a network failure; a server rejection clears the session.
[Local-first notes](local-first.md) describes the trust boundary and retained
local data after sign out.

## Auth request limits

Public credential endpoints limit attempts per IP. Signed-in verification, email
retries and password endpoints limit attempts per account, independent of IP.
Each action uses its own five-minute window and returns 429 with `Retry-After`
when full. See [security](security.md#rate-limiting) for storage and deployment boundaries.

## Browser recovery routes

Both web and admin provide `/forgot-password`, `/account/password` and `/invite`.
Reset and invitation links work signed out. Invalid or consumed links keep the
password form open with an error and a link to request a replacement. Password
confirmation is checked before submitting a credential update to the API.

`/auth/magic/[token]` opens a confirmation page for the current session. A POST
consumes the token, forwards the fresh cookie and returns to the password form.
A GET or an email-link preview does not consume it. An expired confirmation can
be retried by requesting another email. API failures retain their status and are
translated into readable messages by the shared UI helpers.

The operator `create:admin` command also revokes older sessions and one-time tokens
when it updates an existing admin's password.

## Browser request handling

The web and admin Workers authenticate documents, route data requests, and
form submissions in React Router server middleware. The middleware checks the
session with the API before refreshing it. An action can forward replacement
or cleared cookies from the API, and those cookie writes take precedence over
automatic refresh. Loader data exposes display fields and public IDs required
by the UI. The signed session stays in its HttpOnly cookie.

## Registration mode

New users need an invitation by default. Sign in to the admin portal and open
**Users** to email an invitation or copy an invitation link. The recipient opens
the link to set a password. Existing users can still sign in and recover their
passwords.

To enable public registration, set `REGISTRATION_MODE=open` in
`packages/api/.env` for local development, or set
`"REGISTRATION_MODE": "open"` in the API Wrangler `vars` for the hosted
environment. Restart the local API or redeploy the hosted API after the change.

## Web account settings

Open **Account** to update your profile, upload a WebP avatar, or check email
verification. Use **Password settings** to manage your password. To delete an
account, sign in again when prompted and type `DELETE` to confirm. Deletion
revokes sign-in and retains stored data and uploads.
