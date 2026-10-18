# @ak5/api

Hono API on Cloudflare Workers — the only package that touches the database.
Owns auth, JWT issuance, OAuth login callbacks, the cron handler, and the
OpenAPI surface. Neon Postgres via Drizzle.

It exports **types only** to the frontends: `WebApiType` and `AdminApiType` from
`src/app.ts`, consumed via `hc<…ApiType>()` (see `@ak5/webui`'s
`createApiClient`). The package's runtime entry is a guard stub — importing
`@ak5/api` at runtime throws; the worker runs via `wrangler`.

## Layout

- `src/app.ts` — scoped sub-routers (`webApi` / `adminApi`) + the combined `app`.
- `src/routes/` — `auth/`, `me`, `users`, `admin`, `oauth/` (Discord login), `dev/`.
- `src/lib/` — auth workflows, tokens, password hashing, OAuth, admin tooling.
- `src/db/` — Drizzle schema (`schema.ts`), connection (`index.ts`), `functions.sql`.
- `src/middleware/` — `withDb`, `withAuth`, `requireAuth`, `requireRecentAuth`,
  rate limiting, email config.
- `src/cron/` — scheduled jobs (ships with expired-token purge).

## Commands

```bash
pnpm --filter @ak5/api dev          # wrangler dev
pnpm --filter @ak5/api check        # tsc (src + scripts)
pnpm --filter @ak5/api build        # emit the type-only client to dist/
pnpm db:generate                    # drizzle-kit generate (from root)
pnpm db:migrate                     # apply migrations
pnpm create:admin                   # create an admin user
```

Add a route by adding a handler under `src/routes/` and mounting it in the
appropriate scoped router in `app.ts`; document it in
`docs/architecture/api/`.
