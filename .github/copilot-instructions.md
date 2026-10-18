# Copilot instructions

These instructions guide PR review and chat for this repo. They mirror the
canonical conventions in `/CLAUDE.md` for review time — when they and `CLAUDE.md`
disagree, `CLAUDE.md` wins.

## Before you answer anything

1. **Read `/CLAUDE.md` first.** It is the source of truth for conventions.
2. **Learn the doc layout from `/docs/index.md`.** Four buckets by question
   answered: `product/` (what), `architecture/` (how built), `development/` (how
   to run locally), `operations/` (how to run in prod).
3. Prefer editing an existing doc over adding one. New docs go in a bucket and
   get an `index.md` entry in the same PR.

## Code review priorities

**Before anything else, check that the PR updated documentation** per the
docs↔code matrix below.

### Hard rules — flag any violation

1. `pnpm check:all` must pass clean — zero errors **and** zero warnings
   (`prettier --check`, `eslint`, `audit:split`, `tsc`/`svelte-check`).
2. **Public IDs only** in API responses, URLs, JWTs, cookies, and client code —
   never internal sequential PKs.
3. web/admin import from `@ak5/api` **type-only** (the `hc<…ApiType>` RPC types).
   Flag any runtime import of the api package from a frontend.
4. web/admin reach shared behavior through `@ak5/webui`, not direct `@ak5/shared`
   runtime imports.
5. Sensitive actions (password/email change, account delete) go through
   `requireRecentAuth` (15-minute window).
6. Cookie `Domain`/`Secure` come from `COOKIE_ORIGIN` / `PUBLIC_COOKIE_ORIGIN` —
   never hand-set. `JWT_SECRET` matches across all three workers.
7. **No tombstones** — no `// removed X` / `// was previously Y`, in code or docs.
8. Pre-login auth endpoints are rate-limited (login/register/forgot).
9. Every mutating route has a server-side zod (`zValidator`) backstop — never
   trust client validation.
10. Migrations are **additive-only** in a single PR. Dropping a column is a
    two-PR dance (stop writing it, then drop); renaming is a three-PR dance.
    One migration per PR.
11. Secrets never land in git — only `.env.example` keys, `wrangler secret put`,
    or CI secrets. The api owns data-touching secrets; web/admin hold only
    `JWT_SECRET`.
12. The email + password auth core never imports the `auth-oauth` overlay (so it
    stays cleanly removable).
13. **Docs↔code sync — block the PR if the left changed without the right:**

    | Code change                   | Required doc update                     |
    | ----------------------------- | --------------------------------------- |
    | API endpoint added/changed    | `docs/architecture/api/*.md`            |
    | DB table/column added/changed | `docs/architecture/database.md`         |
    | Web route added/changed       | `packages/web/README.md`                |
    | Admin route added/changed     | `packages/admin/README.md`              |
    | Auth behavior changed         | `docs/architecture/auth.md`             |
    | Cron job added/changed        | `docs/architecture/cron.md`             |
    | OAuth provider integration    | `docs/architecture/platforms.md`        |
    | New frontend persona          | `docs/development/add-a-persona.md`     |
    | Test infra changed            | `docs/architecture/testing.md`          |
    | 3rd-party service changed     | `docs/operations/3rd-party-services.md` |
    | Deploy config changed         | `docs/operations/deployment.md`         |
    | CLI command changed           | `packages/cli/README.md`                |
    | Any doc added/renamed/removed | `docs/index.md`                         |

    Narrow exceptions: a pure refactor with no behavior change, or a bugfix that
    doesn't alter the documented contract.

14. Tests accompany features. A new endpoint or auth path ships with a test.

### Soft rules — suggest improvements

- UI/helper used in 2+ apps belongs in `@ak5/webui`; generic pure utility belongs
  in `@ak5/shared`.
- Svelte 5: `$derived` over `const` for reactive props; object syntax for
  conditional classes.
- `page` is 0-indexed end to end; display `page + 1`.
- Use `pnpm cli` for API operations in scripts, not curl/fetch.
- No inline SVGs — use the icon library / `IconSocial`.

### Architecture facts to know

- **Monorepo:** pnpm workspace, `@ak5/{api,web,admin,shared,webui,email,cli}`.
- **Runtime:** Cloudflare Workers (api + both SvelteKit apps).
- **DB:** Neon Postgres + Drizzle; one api worker owns all DB access.
- **Auth:** two identity tables + one exclusive-arc tokens table; JWT
  (`ak5_token`) carries `type`; scoped sub-routers give per-persona `*ApiType`.
- **RPC:** frontends consume `hc<WebApiType>()` / `hc<AdminApiType>()` via the
  `createApiClient` factory in `@ak5/webui`.
- **Dev:** Caddy fronts each slot on one port (`base + (slot-1)*10`).
- **Tests:** Playwright against the live dev stack on a dedicated DB branch.

## What not to do in reviews

- Don't request unrelated refactors or stricter-than-configured lint.
- Don't comment the obvious.
- Don't flag intentional patterns documented in `CLAUDE.md`.

## When in doubt

Default to the rules in `/CLAUDE.md`.
