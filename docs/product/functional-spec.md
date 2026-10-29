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

- **Register** — create an account with email + password.
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
verification status, and links to email verification when needed. The navigation
links to password settings, the items demo and notes. Profile editing, avatar
upload and account deletion are API operations; the starter has no screens for
them. Build those into your product's account UI as needed.

## Admin portal

A separate SvelteKit app uses its own admin identity table. Its screens provide
sign-in, password recovery/settings, a read-only list of the latest 100 active
or banned users, and a read-only items view. The user list has no search or page
controls. Deleted users are excluded.

The authenticated admin API additionally supports these operations. They do not
yet have admin screens:

- **Create accounts** — create a user or admin with an initial password.
- **Invite** — invite a new user (or admin) by email.
- **Ban / unban** — toggle a user's `banned_at`; banned users are rejected at the
  post-login guard, which DB-checks ban/deletion as the source of truth.
- **Impersonate** — act as a user for support/debugging. The admin's own token is
  parked aside, the user token carries an `impersonatedBy` marker, an audit-log row
  is written on start and stop, and stopping swaps the cookies back.
- **Audit log** — paginated records of invitations, bans, unbans, deletions and
  impersonation start/stop. Direct account creation is not currently audited.
- **Diagnostics** — database health, Cloudflare Workers, and local development
  services and token metadata.

This whole admin spine is platform infrastructure — keep it and extend it with
your domain's admin needs rather than rebuilding it.

## Offline notes

Authenticated users can add, edit, and delete private notes on web and native.
Edits apply to local SQLite immediately and sync across devices when connected.
Concurrent edits use accepted event order. Device storage and offline launch
limits are described in [local-first notes](../architecture/local-first.md).
