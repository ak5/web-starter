# ak5-web — Claude Code instructions

> This file is the canonical convention guide for this repo. Read it first. This
> repo is a forkable starter; `@ak5/*` and `ak5web.com` are the default brand
> tokens — run `pnpm rebrand --scope @myco --slug myapp` once after forking to
> replace them with your own (or keep the defaults).

## Documentation

The doc tree is bucketed into four folders by question answered:

- **`docs/product/`** — what we're building (functional spec, flows)
- **`docs/architecture/`** — how it's built (overview, database, auth, api, rpc, security)
- **`docs/development/`** — how to run it locally (setup, conventions, contributing)
- **`docs/operations/`** — how to run it in prod (deployment, 3rd-party services)

**`tmp/`** is the normal scratch pad — throwaway files, local notes, one-off
outputs; gitignored except `tmp/.gitkeep`.

Master index in [`docs/index.md`](docs/index.md). Read it once to learn the
layout, then navigate by bucket. **New docs go in one of the four buckets** —
never at `docs/` root, never in a `misc/`. After adding/renaming/removing a doc,
update `docs/index.md` in the same PR.

**Rule: docs and code stay in sync.** Every PR that touches the left column must
touch the right column in the same PR:

| If the PR touches…              | …it must also update…                             |
| ------------------------------- | ------------------------------------------------- |
| API endpoint added/changed      | `docs/architecture/api/*.md`                      |
| DB table/column added/changed   | `docs/architecture/database.md`                   |
| Web route added/changed         | `packages/web/README.md` routes table             |
| Admin route added/changed       | `packages/admin/README.md` routes table           |
| Auth behavior changed           | `docs/architecture/auth.md`                       |
| Cron job added/changed          | `docs/architecture/cron.md`                       |
| OAuth provider integration      | `docs/architecture/platforms.md`                  |
| New frontend persona added      | `docs/development/add-a-persona.md` + this roster |
| Test infrastructure changed     | `docs/architecture/testing.md`                    |
| 3rd-party service added/changed | `docs/operations/3rd-party-services.md`           |
| Deploy config changed           | `docs/operations/deployment.md`                   |
| Doc added/renamed/removed       | `docs/index.md`                                   |
| CLI command added/changed       | `packages/cli/README.md`                          |

## Environment variables

All packages use `.env` files. `.env` is gitignored; `.env.example` is the
template. **`JWT_SECRET` must match across `@ak5/api`, `@ak5/web`, and
`@ak5/admin`.** Run `pnpm -w run rotate-jwt-secret` to regenerate.

`COOKIE_ORIGIN` / `PUBLIC_COOKIE_ORIGIN` controls the `Domain` + `Secure`
attributes on auth cookies. Three dev shapes plus prod:

- `localhost` or bare IPv4 — no Domain, no Secure
- `.ak5.localhost` / `.ak5<n>.localhost` — Domain set, Secure off (dev is plain
  HTTP). This is what `pnpm dev` writes.
- `.ak5web.com` — Domain set, Secure on (prod)

The api uses `COOKIE_ORIGIN`; the SvelteKit apps use `PUBLIC_COOKIE_ORIGIN`. See
`packages/shared/src/cookie.ts`. **The api owns every data-touching secret**
(provider secrets, encryption keys); web/admin hold only
`JWT_SECRET`, and only to verify cookies — never to write data.

## Dev ports

Caddy fronts every app on a single port per slot (slot 1 → `:8359`, slot 2 →
`:8369`, slot N → `:835(N-1)9`):

- API: **`api.ak5.localhost:8359`**
- Web: **`web.ak5.localhost:8359`**
- Admin: **`admin.ak5.localhost:8359`**
- Email preview: **`preview.ak5.localhost:8359`**
- Email mock: **`mock.ak5.localhost:8359`**

Direct upstream ports (api 8350, web 8351, admin 8352, preview 8354, mock 8355)
reach `127.0.0.1` for bypassing Caddy. The scheme is `base + (slot-1)*10`. Apps
bind 127.0.0.1 only — Caddy is the public-facing process.

**Starting the stack without clobbering ports:** prefer `pnpm dev:auto`, which
picks the next slot whose ports are all free (`scripts/next-free-slot.sh`) — not
bare `pnpm dev`, which forces slot 1 and collides with anything already on it.
The chosen slot's ports/URLs are written to `.env.dev-slot` (mise auto-loads it);
read that for the live ports rather than hardcoding. To run a single surface,
`pnpm dev:api` / `dev:web` / `dev:admin` honor the active slot's ports too.

## Monorepo commands

**Prefer root scripts (`pnpm X`) over `pnpm --filter @ak5/<pkg> X` when a root
script exists.** Check `package.json` for the current list. If a root equivalent
is missing and would be useful, add it there.

`pnpm -w run dev` spawns the full stack: shared/webui/email watchers, api/web/
admin dev servers, email mock + preview, Caddy. First-time setup runs
`pnpm -w run dev:init`, which builds libs once before scaffolding `.env` files.
**There is no lifecycle `prepare` hook building libs** — every build step is
explicit. Use `pnpm -w run build:libs` for a clean one-shot rebuild (it builds in
dependency order: shared → email → webui → api).

## Branches & deploys

**`main` is the trunk.** Create short-lived feature branches from `main` and PR
into `main`. PRs deploy isolated preview Workers sharing staging data. Merging
into `main` runs CI and automatically deploys staging. Production is a manual
`promote.yml` workflow from `main`, accepting only a full SHA already successfully
deployed to staging. Deploy through GitHub Actions; see
[deployment](docs/operations/deployment.md). Never deploy production directly.

## Packages

- **`@ak5/api`** — Hono on CF Workers. Auth, DB, cron, OAuth callbacks, JWT
  issuance. Cloudflare D1 + Drizzle. Exports `WebApiType` / `AdminApiType`.
- **`@ak5/web`** — SvelteKit on CF Workers. Public app surface. Port 8351.
- **`@ak5/admin`** — SvelteKit on CF Workers. Admin portal. Port 8352.
- **`@ak5/sync`** — LiveStore notes schema, materializers, and HTTP sync client.
  Web uses OPFS, native uses Expo SQLite; the API coordinates sync through
  `NotesSync` with a D1 event log. See `docs/architecture/local-first.md`.
- **`@ak5/shared`** — Core cross-package contracts and pure utilities (cookie,
  jwt, pagination, public-id, generic types). Built to `dist/` via `tsc`.
  Web/admin runtime code reaches shared behavior through `@ak5/webui`, not direct
  `@ak5/shared` imports.
- **`@ak5/webui`** — Shared Svelte 5 components, the `createSvelteKitHandle`
  factory, and the `createApiClient` Hono-client factory. **Any UI element or
  frontend SvelteKit helper used in 2+ apps MUST go here.** Built via
  `svelte-package`.
- **`@ak5/email`** — Transactional email templates + native Cloudflare sender. Mock email
  server + preview server in dev.
- **`@ak5/cli`** — Dev CLI wrapping the api endpoints. Run via `pnpm cli`.

To add a third frontend persona, follow `docs/development/add-a-persona.md` — the
split generalizes to N SvelteKit apps over one API worker.

## Native mobile

- **`@ak5/mobile`** — Svelte 5 on Symbiote Native / React Native for iOS and Android.
  Lives in `packages/mobile`, inside the pnpm workspace. Use native primitives,
  Svelte runes, the typed Hono client, and `@symbiote-native/secure-store`.
  Web components and DOM APIs do not run in the native renderer.
- `pnpm dev:app` picks a free Metro port; `pnpm app:ios` / `pnpm app:android`
  use that port. Read the package's `.env.dev-slot`.
- See [mobile setup](packages/mobile/README.md) for native toolchains and API URLs.

## Public IDs — no sequential PKs in APIs

**Rule: never expose internal IDs.** All API responses, URLs, JWTs, and frontend
code use `publicId` (prefixed: `u-`, `a-`, `t-`, …). Internal nanoid PKs exist
only for joins — never appear in JSON responses, URL params, cookies, or
client-side code. Generator: `packages/shared/src/public-id.ts`.

## Auth

Full treatment in `docs/architecture/auth.md`. One-line summary:

- Two identity tables (`users`, `admin_users`), one `tokens` table with an
  exclusive-arc constraint
- **Pre-login** endpoints split by role (`/auth/login` vs `/auth/admin/login`).
  **Post-login** unified (JWT carries `type`)
- **Scoped sub-routers** in `app.ts`: `WebApiType` / `AdminApiType` each expose
  only their own pre-login set + the shared post-login set.
  `api.auth.admin.login` is a compile error from non-admin contexts
- JWT: HS256, `ak5_token` httpOnly cookie, 7-day max-age. `sub` is always a
  `public_id`, never an internal PK
- Sensitive actions require `recentAuthAt` within 15 minutes via
  `requireRecentAuth`
- `JWT_SECRET` must match across all three workers

**What NOT to change without reading `docs/architecture/auth.md` first:** the
two-user-table shape, the exclusive-arc tokens shape, the pre-login/post-login
split, the cookie domain rules. Each is load-bearing.

**OAuth login** (Discord; add others per `docs/architecture/platforms.md`) is a
removable overlay: the email + password core never imports from it, so
`auth-oauth` — its API routes/lib **and** the web `OAuthLogin.svelte` button —
can be deleted without breaking auth (see `docs/architecture/auth.md`).
Channel-attach OAuth is business-domain and is not part of this starter.

## No tombstones — code or docs

No tombstone comments (`// removed X`, `// was previously Y`), no references to
deleted/past code, no `_unused` annotations. Comments describe what the current
code does or why — never what used to be there. **This applies equally to
documentation:** docs reflect the current state. If a feature is removed, delete
its docs.

## Code quality

**Rule: `pnpm check:all` passes cleanly — zero errors AND zero warnings.**
Includes `prettier --check`, `eslint`, `audit:split`, `check:docs` (relative
doc-link validation, `scripts/check-doc-links.sh`), and `svelte-check` /
`tsc --noEmit` across all packages. Fix warnings before considering work complete.

## Tests

Three layers — full treatment in `docs/architecture/testing.md`:

- **Unit** (pure, no DB/server): `pnpm test:unit` runs before push and in CI.
- **Integration**: `pnpm test:db` runs the real Hono app and D1 driver against
  disposable local Wrangler bindings, including constraints and atomic batches.
- **End-to-end**: `pnpm test --workers=1` runs Playwright against the local stack.
  CI provisions local D1 from migrations; no database credentials are needed.
  Browser tests are not Git hooks.

Push coverage down: unit if it can, integration if it needs the DB, e2e only for
what needs the whole stack.

## Split boundaries

`pnpm audit:split` (`scripts/audit-split-boundaries.sh`) mechanically enforces the
package architecture and guards these very instruction files against drift. It
runs in `check:all`, in the lefthook pre-commit hook, and in CI. Key invariants:

- web/admin import from `@ak5/api` **type-only** (the RPC types), never its
  runtime
- web/admin reach shared behavior via `@ak5/webui`, not direct `@ak5/shared`
- the email + password auth core never imports the OAuth overlay
- SvelteKit route files stay thin — `+page`/`+layout`/`+server` modules delegate
  to package libs

## Svelte 5 patterns

Use `$derived` not `const` for reactive props. `$derived` is writable — use for
form inputs that sync with server data. Prefer the object syntax for conditional
classes:

```svelte
<div class={{
  'base-classes': true,
  'conditional-class': someCondition
}}>
```

## Pagination

**Convention: `page` is 0-indexed everywhere.** The API computes
`offset = page * limit`. Frontend pattern: `let page = $state(0)`. Display
1-indexed for humans (`page + 1`), but send `String(page)` directly to the API.

## CLI (`pnpm cli`)

**Rule: always use `pnpm cli` instead of curl/fetch for API operations in
dev/scripts.** The CLI handles auth tokens, JSON parsing, and error formatting.
See `packages/cli/README.md`.

## Icons

Use a single icon library for general icons and the `@ak5/webui` `IconSocial`
component for social-platform icons. **Do NOT use inline SVGs.**

## Design

English-only UI. DaisyUI theme. Single-page app feel — minimize chrome, favor
focused content per route.
