# Architecture overview

The split monorepo is **one API worker over N React Router frontends**, glued by a
typed Hono RPC contract. The API owns all data and secrets; the frontends are
thin presentation shells that call the API over a fully-typed client.

## The shape

```
                    ┌──────────────────────────────┐
                    │  @ak5/api  (Hono / CF Worker) │
   browser ───────► │  auth · DB · cron · JWT issue │ ──► Cloudflare D1
                    │  owns DB binding + secrets  │     (Drizzle ORM)
                    └──────────────┬───────────────┘
                       exports types only (WebApiType / AdminApiType)
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                       ▼
     ┌────────────┐         ┌────────────┐          (more personas…)
     │ @ak5/web   │         │ @ak5/admin │           copy web/, claim
     │ React Router │         │ React Router │           a slot + a type
     └─────┬──────┘         └─────┬──────┘
           └──────────┬───────────┘
                      ▼
                ┌────────────┐
                │ @ak5/webui │  React components + auth middleware
                │            │  + createApiClient  (re-exports select @ak5/shared)
                └─────┬──────┘
                      ▼
                ┌────────────┐
                │ @ak5/shared│  leaf: cookie · jwt · pagination · public-id
                └────────────┘
```

## Packages

| Package       | Role                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@ak5/api`    | Hono on CF Workers. Auth, DB access, JWT issuance, OAuth callbacks, cron. The only worker holding data secrets. Exports `WebApiType` / `AdminApiType`. |
| `@ak5/web`    | React Router on CF Workers. Public app surface.                                                                                                        |
| `@ak5/admin`  | React Router on CF Workers. Admin portal.                                                                                                              |
| `@ak5/mobile` | Optional React Native and Expo app for iOS and Android.                                                                                                |
| `@ak5/shared` | Leaf package: cross-package contracts + pure utils (cookie, jwt, pagination, public-id). No internal deps.                                             |
| `@ak5/sync`   | LiveStore notes schema, events, materializers, and HTTP sync client for web and native.                                                                |
| `@ak5/webui`  | Shared React components, `createAuthMiddleware`, `createApiClient`. The web/admin path to shared behavior.                                             |
| `@ak5/email`  | React Email templates and native Cloudflare sender with a local mock and preview.                                                                      |
| `@ak5/cli`    | Dev CLI wrapping the API endpoints (`pnpm cli`).                                                                                                       |

## Dependency direction

`shared` has no workspace dependencies. `webui` depends on `shared` and
re-exports what the browser apps need. `api` depends on `shared` and `email`.
`web` and `admin` use `webui` and consume the API through the Hono RPC types
`WebApiType` and `AdminApiType`.

Two rules fall out, both enforced mechanically by `pnpm audit:split`:

- Web and admin reach `@ak5/shared` through `@ak5/webui`.
- Web, admin, and mobile import `@ak5/api` **type-only**.

## Runtime & data

Every worker runs on **Cloudflare Workers**. The database is **Cloudflare D1**
accessed through **Drizzle ORM**, and only `@ak5/api` ever touches it. D1 enforces
auth rate limits, R2 backs uploads, and optional remote MCP uses dedicated KV
for OAuth grants. The frontends have no DB binding. They use `JWT_SECRET` to
verify and refresh session cookies.

## Where to go next

- [auth.md](auth.md) — identity tables, tokens, JWT, the pre/post-login split.
- [database.md](database.md) — tables, enums, migration policy.
- [rpc.md](rpc.md) — the typed Hono client contract and the type-only boundary.
- [security.md](security.md) — public IDs, rate limits, cookies, secrets.
- [cron.md](cron.md) · [platforms.md](platforms.md) · [api/index.md](api/index.md)

## Native mobile

`@ak5/mobile` lives in `packages/mobile` when enabled. Its React Native
components run on the checked-in iOS and Android hosts. The app uses
`WebApiType`, pure `@ak5/shared` contracts, and Expo SecureStore for session
data. `@ak5/webui` serves the browser apps. Metro resolves
`@ak5/shared/cookie` after `pnpm build:libs`. See [mobile setup](../../packages/mobile/README.md)
and [project profiles](../development/start-project.md).

Web and native offline notes share `@ak5/sync`. LiveStore materializes local
SQLite and synchronizes events through the API's Durable Object to D1; see
[local-first notes](local-first.md).
