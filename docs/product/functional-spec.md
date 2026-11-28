# Functional spec — the example surface

This describes the example screens and API capabilities shipped by the starter.
A fresh `pnpm dev:auto` starts the web app, admin portal and local email tools.
The API also exposes account and administration operations for a consuming app
to build on.

**The deal:** this is the _platform baseline_. Replace the product surface (the
landing page and the user dashboard) with your domain. **Keep the auth and admin
spine** — it's the load-bearing part of the starter and the hardest to get right.
There is no business domain here on purpose.

## Public landing

A single public route at `/`, reachable without authentication. In the starter
it's a minimal placeholder — your product's marketing/entry surface replaces it.
It links to the auth flow.

## Auth flow

The full email + password account lifecycle, served by the api and the web
surface:

- **Register** — create an account by invitation. Public email and password signup is available when `REGISTRATION_MODE=open`.
- **Verify email** — a six-character alphanumeric code is mailed on register; entering it at
  `/account/verify` marks the email verified. Unverified accounts can sign in but are nudged to verify.
- **Login** — email + password; issues the session cookie.
- **Forgot / reset password** — request a reset link by email, set a new password
  from the link.
- **Magic-link reauth** — for sensitive actions, a recent-auth window is enforced;
  an emailed link opens a confirmation page, whose POST re-establishes recency
  without a full re-login.

OAuth login (Discord) is shipped as a **removable overlay** on top of this
core — present but deletable without touching the email + password path.

## Authed user dashboard

After login, the dashboard confirms the session, shows the user's name, email and
verification status, and links to email verification when needed. The navigation links to Account settings, items, and notes. Account settings
supports profile edits, WebP avatar upload, verification status, password
settings, and account deletion after recent sign-in.

## Admin portal

A separate React Router app uses its own admin identity table. Its Users screen supports search, filters, pagination, invitations, and
invitation replacement for regular users and admins. Deleted users are excluded.
The Audit Log shows recorded admin actions. The Items page is read-only.

Other admin API capabilities include:

- **Create accounts** — create a user or admin with an initial password.
- **Ban / unban** — toggle a user's `banned_at`; banned users are rejected at the
  post-login guard, which DB-checks ban/deletion as the source of truth.
- **Impersonate** — act as a user for support/debugging. The admin's own token is
  parked aside, the user token carries an `impersonatedBy` marker, an audit-log row
  is written on start and stop, and stopping swaps the cookies back.
- **Diagnostics** — database health, Cloudflare Workers, and local development
  services and token metadata.

This whole admin spine is platform infrastructure — keep it and extend it with
your domain's admin needs rather than rebuilding it.

## Offline notes

Authenticated users can add, edit, and delete private notes on web and native.
Edits apply to local SQLite immediately and sync across devices when connected.
Concurrent edits use accepted event order. Device storage and offline launch
limits are described in [local-first notes](../architecture/local-first.md).

## Native mobile

The optional iOS and Android app opens Offline notes after restoring a session
or signing in. Registration, verification-code entry and resend, and password
recovery requests are available in the app. The recovery email opens the web
password-reset form.

Verified users can switch to Online items, page through and refresh the list,
and create, edit, or delete JSON items. Expo SecureStore keeps the session
across app launches. Signing out clears the local session. Reopen Offline notes
with the same account to access its local data.
