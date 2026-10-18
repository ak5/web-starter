# Architecture overview

The split monorepo is **one API worker over N SvelteKit frontends**, glued by a
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
     │ SvelteKit  │         │ SvelteKit  │           a slot + a type
     └─────┬──────┘         └─────┬──────┘
           └──────────┬───────────┘
                      ▼
                ┌────────────┐
                │ @ak5/webui │  Svelte 5 components + createSvelteKitHandle
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
| `@ak5/web`    | SvelteKit on CF Workers. Public app surface.                                                                                                           |
| `@ak5/admin`  | SvelteKit on CF Workers. Admin portal.                                                                                                                 |
| `@ak5/shared` | Leaf package: cross-package contracts + pure utils (cookie, jwt, pagination, public-id). No internal deps.                                             |
| `@ak5/webui`  | Shared Svelte 5 components, `createSvelteKitHandle`, `createApiClient`. The web/admin path to shared behavior.                                         |
| `@ak5/email`  | Transactional email templates + native Cloudflare sender; dev mock + preview.                                                                          |
| `@ak5/cli`    | Dev CLI wrapping the API endpoints (`pnpm cli`).                                                                                                       |

## Dependency direction

`shared` is the leaf — nothing internal depends on, and it depends on nothing
internal. `webui` depends on `shared` and re-exports the slice frontends need.
`api` depends on `shared` + `email`. `web`/`admin` depend on `webui`, and on
`api` **type-only** — they consume `hc<WebApiType>()` / `hc<AdminApiType>()` RPC
types, never the API's runtime (its "runtime" entry is a no-op type carrier).

Two rules fall out, both enforced mechanically by `pnpm audit:split`:

- Frontends **never** import `@ak5/shared` directly — they go through `@ak5/webui`.
- Frontends import `@ak5/api` **type-only** — no runtime edge from a frontend to
  the API worker.

## Runtime & data

Every worker runs on **Cloudflare Workers**. The database is **Cloudflare D1**
accessed through **Drizzle ORM**, and only `@ak5/api` ever touches it. KV backs
rate limiting and cron locks; R2 backs uploads. The frontends have no DB binding
and no data secrets — only `JWT_SECRET`, and only to verify cookies.

## Where to go next

- [auth.md](auth.md) — identity tables, tokens, JWT, the pre/post-login split.
- [database.md](database.md) — tables, enums, migration policy.
- [rpc.md](rpc.md) — the typed Hono client contract and the type-only boundary.
- [security.md](security.md) — public IDs, rate limits, cookies, secrets.
- [cron.md](cron.md) · [platforms.md](platforms.md) · [api/index.md](api/index.md)

## Native mobile

`@ak5/mobile` lives in `packages/mobile`. Svelte 5 components render native views
through Symbiote Native over React Native's Fabric/Hermes runtime. The app uses
the same type-only `WebApiType` and pure shared contracts; browser components
from `@ak5/webui` remain specific to SvelteKit. Metro resolves the compiled
`@ak5/shared/cookie` entry after `pnpm build:libs`. Encrypted session persistence uses
Symbiote secure-store. See [mobile setup](../../packages/mobile/README.md).

Web and native offline notes share `@ak5/sync`. LiveStore materializes local
SQLite and synchronizes events through the API's Durable Object to D1; see
[local-first notes](local-first.md).
