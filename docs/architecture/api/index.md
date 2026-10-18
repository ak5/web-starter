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
| **post-login** | unified    | `requireAuth()`        | `/auth/me`, `/auth/logout`, `/auth/change-password`                           |
| **me-core**    | user JWT   | `requireAuth('user')`  | `PATCH /me/profile`, `POST /me/avatar`, `DELETE /me`                          |
| **items**      | user JWT   | `requireAuth('user')`  | `GET/POST /items`, `GET/PATCH/DELETE /items/:id` (example resource)           |
| **admin-core** | admin JWT  | `requireAuth('admin')` | `/admin/users`, `/admin/invite`, `/admin/impersonate/:id`, `/admin/audit-log` |

- **pre-login** is split by role because there's no token yet to disambiguate
  the caller. These routes are the rate-limit surface.
- **post-login** is unified — the JWT's `type` carries the role, so one route set
  serves both identities.
- **me-core** and **admin-core** are the authenticated business surface, pinned
  to a single identity type by `requireAuth('user' | 'admin')`, which also
  DB-checks `deleted_at` / `banned_at` (see [../auth.md](../auth.md)).

## Scoping

`app.ts` mounts these groups into two scoped routers and exports their types.
`WebApiType` exposes the web pre-login set + post-login + me-core; `AdminApiType`
exposes the admin pre-login set + post-login + admin-core. A frontend can only
call routes in its own scope — calling outside it is a **compile error**.

## Cross-cutting middleware

Every request passes through `withDb` (attaches the DB), `withAuth` (parses the
cookie into `c.var.auth`, null when absent), and zod validation on mutations.
Route guards (`requireAuth`, `requireRecentAuth`) sit per-route on top.

## Per-area docs

This is the one-page overview. As the surface grows, **per-area route docs live
beside this file** (`docs/architecture/api/<area>.md`) — one per router, listing
its endpoints, request/response shapes, and guards. Add the area doc in the same
PR that adds the router, and link it from here.

- [items.md](items.md) — the example user-scoped CRUD resource (a demo to
  replace with your real domain).

## Email delivery responses

`POST /auth/register` returns `{ok: true, publicId, verificationEmailSent}` and a
session cookie after account creation, even when delivery fails. Retry using
`POST /auth/resend-verification`; it and `POST /auth/request-reauth` return
`503 {error: "email_delivery_failed"}` when sending fails. Public user/admin
forgot-password responses do not disclose account existence or delivery failure.

`POST /admin/invite` returns `503 {error: "invitation_delivery_failed"}` if mail
fails after the account, token, and creation audit commit. Do not repeat creation;
the recipient can request a password reset. See [auth](../auth.md).

## LiveStore sync

`POST /sync?storeId=notes-v1-<user-public-id>&transport=http` accepts the official
LiveStore HTTP RPC protocol. It uses the same user session cookie, validates
store ownership and note events, and delegates to `NotesSync`. Web calls its
same-origin proxy; native supplies a cookie header. WebSockets and client auth
payloads are disabled. See [local-first notes](../local-first.md).
