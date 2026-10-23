# Functional spec — the example surface

This describes what the starter **ships out of the box**: a minimal but complete
account platform. It exists so a fresh `pnpm dev` is visibly alive and so the
auth/admin spine is wired end to end.

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
- **Verify email** — a verification link is mailed on register; clicking it marks
  the email verified. Unverified accounts can sign in but are nudged to verify.
- **Login** — email + password; issues the session cookie.
- **Forgot / reset password** — request a reset link by email, set a new password
  from the link.
- **Magic-link reauth** — for sensitive actions, a recent-auth window is enforced;
  a magic link re-establishes recency without a full re-login.

OAuth login (Discord) is shipped as a **removable overlay** on top of this
core — present but deletable without touching the email + password path.

## Authed user dashboard

After login, the user lands on a minimal dashboard that confirms the session
("you're signed in") and exposes account self-service: edit profile, set/change
password, and delete account. This is the placeholder you replace with your
product's authed surface — the session, profile, and account-management plumbing
underneath it stays.

## Admin portal

A separate admin surface (its own SvelteKit app, its own identity table) for
operating the platform:

- **User list** — browse/search users (paginated, 0-indexed).
- **Invite** — invite a new user (or admin) by email.
- **Ban / unban** — toggle a user's `banned_at`; banned users are rejected at the
  post-login guard, which DB-checks ban/deletion as the source of truth.
- **Impersonate** — act as a user for support/debugging. The admin's own token is
  parked aside, the user token carries an `impersonatedBy` marker, an audit-log row
  is written on start and stop, and stopping swaps the cookies back.
- **Audit log** — an append-only record of admin actions (invites, bans,
  impersonation start/stop) for accountability.

This whole admin spine is platform infrastructure — keep it and extend it with
your domain's admin needs rather than rebuilding it.

## Offline notes

Authenticated users can add, edit, and delete private notes on web and native.
Edits apply to local SQLite immediately and sync across devices when connected.
Concurrent edits use accepted event order. Device storage and offline launch
limits are described in [local-first notes](../architecture/local-first.md).
