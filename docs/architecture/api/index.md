# API routes

How the API surface is organized. The routers live in
`packages/api/src/routes/` and are mounted under scoped sub-routers in
`src/app.ts` (see [../rpc.md](../rpc.md) for how `WebApiType` / `AdminApiType`
are exported and consumed).

## Organizing principle

Routes group by **who may call them and when**, not by feature:

| Group          | Scope      | Gate                   | Examples                                                                      |
| -------------- | ---------- | ---------------------- | ----------------------------------------------------------------------------- |
| **pre-login**  | role-split | none (rate-limited)    | `/auth/login`, `/auth/admin/login`, `/auth/register`, `/auth/forgot-password` |
| **post-login** | unified    | `requireAuth()`        | `/auth/me`, `/auth/verify-email`, `/auth/change-password`                     |
| **me-core**    | either JWT | `requireAuth()`        | `PATCH /me/profile`, `POST /me/avatar`, `DELETE /me`                          |
| **items**      | user JWT   | `requireAuth('user')`  | `GET/POST /items`, `GET/PATCH/DELETE /items/:id` (example resource)           |
| **admin-core** | admin JWT  | `requireAuth('admin')` | `/admin/users`, `/admin/invite`, `/admin/impersonate/:id`, `/admin/audit-log` |

- **pre-login** is split by role because there's no token yet to disambiguate
  the caller. These routes are rate-limited by IP.
- **post-login** is unified — the JWT's `type` carries the role, so one route set
  serves both identities. Verification, mail retries and password operations are
  rate-limited by account. `/auth/logout` clears cookies without requiring a valid
  session, so expired or disabled accounts can sign out.
- **me-core** and **admin-core** are the authenticated business surface. `/me` supports
  both identities; `/admin` requires an admin. Every `requireAuth` guard checks
  the active account in D1, including `deleted_at` / `banned_at` (see [../auth.md](../auth.md)).

## Scoping

`app.ts` mounts these groups into two scoped routers and exports their types.
`WebApiType` exposes the web pre-login set + post-login + me-core; `AdminApiType`
exposes the admin pre-login set + post-login + admin-core. A frontend can only
call routes in its own scope — calling outside it is a **compile error**.

## Cross-cutting middleware

Every request passes through `withDb` (attaches the DB), `withAuth` (parses the
cookie into `c.var.auth`, null when absent), and body validation appropriate to each route (JSON schemas or multipart checks).
Route guards (`requireAuth`, `requireRecentAuth`) sit per-route on top.

## Per-area docs

This is the one-page overview. As the surface grows, **per-area route docs live
beside this file** (`docs/architecture/api/<area>.md`) — one per router, listing
its endpoints, request/response shapes, and guards. Add the area doc in the same
PR that adds the router, and link it from here.

- [items.md](items.md) — the example user-scoped CRUD resource (a demo to
  replace with your real domain).

## Signup contract

`POST /auth/register` accepts `email`, `password` and `username`. The starter does
not require or record policy acceptance. `GET /auth/options` returns password and
username constraints, `registrationOpen`, and `discordEnabled`. Discord OAuth
returns `503 {error: "discord_unavailable"}` when credentials are missing. Public registration requires
`REGISTRATION_MODE=open`; the default is invite-only. Add application policy handling across all signup paths as
described in [auth](../auth.md#signup-policies).

## Email delivery responses

`POST /auth/register` returns `{ok: true, publicId, verificationEmailSent}` and a
session cookie after account creation, even when delivery fails. Retry using
`POST /auth/resend-verification`; it and `POST /auth/request-reauth` return
`503 {error: "email_delivery_failed"}` when sending fails. Public user/admin
forgot-password responses do not disclose account existence or delivery failure.

`GET /admin/users` returns regular users in `users` and non-deleted admin accounts
in `admins`. Pass a zero-based `page` to access later pages of regular users. The
response includes `pagination` for the 100-user pages. Use `q` to search email,
username, or public ID, and `status` to filter by `all`, `active`, `banned`, or
`pending`. Admin entries include their
public ID, username, email, and email verification status.

`POST /admin/invite` accepts `delivery: "email"` (the default) or `delivery: "link"`
for regular users. Link mode returns an `inviteUrl` in a `Cache-Control: no-store`
response. Email mode with missing sender or transport returns
`503 {error: "invite_email_unavailable"}` before creating an account.

`POST /admin/invite` returns `503 {error: "invitation_delivery_failed"}` if mail
fails after the account, token, and creation audit commit. Use
`POST /admin/invite/:publicId/replace` with `delivery` to replace the pending
invitation and invalidate the previous link. Admin invitations are email-only.
See [auth](../auth.md).

## Cloudflare diagnostics

`GET /admin/integrations/cloudflare` requires an admin session. Missing credentials
return `configured: false, available: false`. HTTP errors, Cloudflare REST failures,
GraphQL errors and missing result data return `configured: true, available: false`
with an error message. Successful empty results remain `available: true` with an
empty `workers` array; an unavailable integration must not be shown as zero traffic.

The `/admin/logs`, `/admin/audit-log` and local-only `/admin/tokens/:email`
responses omit internal record IDs. Audit actors and token subjects use account
public IDs. Token diagnostics expose purpose, expiry, attempt counts and payload
key names, never token hashes or payload values. These are read-only lists;
records are not addressed by a returned database primary key.
Log and audit pages use zero-based offsets. An invalid page falls back to page zero.

## LiveStore sync

`POST /sync?storeId=notes-v1-<user-public-id>&transport=http` accepts the official
LiveStore HTTP RPC protocol. It uses the same user session cookie, validates
store ownership and note events, and delegates to `NotesSync`. Web calls its
same-origin proxy; native supplies a cookie header. WebSockets and client auth
payloads are disabled. See [local-first notes](../local-first.md).

## Password and session responses

`POST /auth/set-password`, `POST /auth/change-password`, and
`POST /auth/accept-invite` return a replacement `ak5_token` cookie after committing
the credential and session-generation change. Clients must store/forward it.
Older cookies, including refreshed copies, then receive 401. `GET /auth/me` is the
frontend session-validity check. See [session revocation](../auth.md#session-revocation).

## Avatar validation and account deletion

`POST /me/avatar` accepts WebP uploads up to 5MB with matching filename, MIME type
and file signature. Objects are served with `image/webp` metadata. This is a
signature check rather than an image decoder. Admin user deletion and its audit
entry commit atomically; see [retention](../security.md#avatar-uploads-and-retention).
