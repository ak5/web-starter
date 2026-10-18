# Testing

Three layers, by cost and what only breaks at that level:

| Layer                 | Covers                                                                                                              | Command                 | Runs in                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------- |
| **Unit**              | pure functions — JWT sign/verify, cookie domain rules, public-id, pagination, validation schemas (no DB, no server) | `pnpm test:unit`        | **pre-push** hook + CI (and skips DB-backed ones)                   |
| **Integration** (api) | the real Hono app in-process against Postgres — routes → middleware → lib → DB                                      | `pnpm test:unit` + a DB | CI `db-tests` (ephemeral Neon branch); skips without `DATABASE_URL` |
| **E2E** (Playwright)  | the running stack — cross-worker cookies, Caddy routing, the web/admin UIs                                          | `pnpm test`             | CI `e2e` job; needs the live stack                                  |

Push coverage **down** the table: an edge case belongs in a unit test if it can,
an integration test if it needs the DB, and e2e only for what genuinely needs
the whole stack. e2e stays a thin smoke layer, not a place to re-test validation.

## Unit tests

Pure-function suites, no database or server — run with `pnpm test:unit` (also
the **lefthook pre-push** hook). Coverage:

- **Readiness helper** — checks streamed endpoints and exits without retaining
  response bodies or hanging before Playwright.
- **Web UI auth hook** — reads runtime credentials without a platform object,
  preserves host-only cookies, and rejects missing configuration.
- **Deployment gates** — promotion rejects non-main SHAs, skipped staging deployments,
  wrong events and invalid SHAs; preview configuration checks isolated names and service
  bindings and rejects production routes.
- **`@ak5/shared`** — `jwt` (sign/verify round-trip, tamper/expiry/wrong-secret
  rejection, cookie domain+secure rules), `cookie` (`parseOrigin` shapes,
  `parseCookie`), `public-id` (prefixes, `isPublicId`), `pagination` (offset
  math + `hasNext`/`hasPrev` boundaries), `util`.
- **`@ak5/api`** — `auth-form` validation schemas (email normalisation,
  username/password boundaries, `legalAcceptance`).

### DB-backed integration tests (api)

Some api suites drive the **real Hono app in-process** (`app.request(...)`), so a
request flows route → auth middleware → lib → Postgres without a running server.
`packages/api/src/routes/items.test.ts` is the reference: it forges a user JWT,
exercises the full `items` CRUD, and asserts ownership scoping + validation.

- They run on the Neon **fetch** transport (`neonConfig.poolQueryViaFetch`), so no
  WebSocket polyfill is needed under Node.
- They read `DATABASE_URL_TEST` (preferred — a throwaway branch) or `DATABASE_URL`
  and **skip** when neither is set, so `pnpm test:unit` stays green without a DB.
- Test files (`src/**/*.test.ts`) are **excluded from the worker build tsconfig**
  (they use Node globals, not Worker types) and executed by the `node --test`
  runner via `tsx`.

## End-to-end against the live stack

Playwright drives the **running dev stack** (Caddy + api + web + admin) rather
than a mocked server, so tests exercise real cookie domains, real cross-worker
calls, and real DB writes. Config: `playwright.config.ts`; specs under `tests/`
(`tests/api`, `tests/web`, `tests/admin`) with shared helpers in
`tests/helpers/`. The `api` project drives the HTTP API directly (no browser);
`web`/`admin` are browser suites. Run the stack (`pnpm dev`) then `pnpm test`
(or a single project: `pnpm test:api` / `:web` / `:admin`).

### Test database branch

Locally, point `DATABASE_URL_TEST` at a **dedicated Neon test branch**;
`pnpm db:reset:test` wipes it (`DROP SCHEMA … CASCADE`) and re-applies migrations,
so suites start from a known empty schema and never touch dev data. Because it is
a Neon branch, this is cheap and isolated — no second database server.

**In CI, branches are ephemeral.** The `db-tests` job creates a throwaway Neon
branch per run (`neondatabase/create-branch-action`), runs `db:migrate` + the
DB-backed api tests against it, and deletes it at the end
(`delete-branch-action`, `if: always()`) — parallel-safe, no shared state. A
`guard` job skips the DB-backed jobs when `NEON_API_KEY` / `NEON_PROJECT_ID`
aren't set (fork PRs, unconfigured repos), so CI degrades gracefully rather than
failing. Set `NEON_API_KEY` (secret) + `NEON_PROJECT_ID` (variable) to enable.

### Preflight health gate

Before any test executes, a **preflight health check** confirms every upstream
(api, web, admin, mock email) is reachable. It **polls** each endpoint until it
responds or a deadline passes (`PREFLIGHT_TIMEOUT_MS`, default 90s), so it
tolerates a stack that's still booting — CI starts it with `pnpm dev &` and runs
preflight immediately. If an endpoint never comes up the run fails with a focused
diagnostic instead of a wall of flaky timeouts. Run it standalone with
`pnpm test:preflight`.

### Test isolation

Tests **self-isolate** — no global DB wipe between cases. Helpers in
`tests/helpers/api.ts`:

- **`uniqueEmail` / `uniqueUsername`** — collision-free credentials so parallel
  registrations don't fight over the same account.
- **`syntheticIp` / `newApiContext`** — each test's API context sends a distinct
  `cf-connecting-ip` (+ `x-forwarded-for`), so the per-IP pre-login rate limiter
  (which reads `cf-connecting-ip ?? x-forwarded-for`, see
  `middleware/rate-limit.ts`) never bleeds across cases. (`wrangler dev` lets a
  request set `cf-connecting-ip`; real Cloudflare sets it itself.)
- **`registerUser`** — registers a throwaway user and returns an authenticated
  context (the `ak5_token` cookie lives in the context's jar).

## Projects

Playwright is split into projects so suites can run independently:

| Project      | Covers                                                        |
| ------------ | ------------------------------------------------------------- |
| `test:api`   | API endpoints directly (auth, me, admin, health, rate-limit). |
| `test:web`   | Public app flows through the browser.                         |
| `test:admin` | Admin portal flows.                                           |
| `test:smoke` | Golden-path check against a **live deployment** (see below).  |

`pnpm test` runs the dev e2e set (`api` + `web` + `admin`); the per-project
scripts narrow it during development. That suite runs in the CI `e2e` job
(against an ephemeral Neon branch), **not** `check:all` — which stays a fast,
DB-less Node gate.

### Deployment smoke (`test:smoke`)

A self-contained golden path — register → me → item CRUD → logout → login →
**soft-delete the account** — that you point at a real deployment:

```sh
PUBLIC_API_URL=https://ak5-api.ak5.workers.dev      pnpm test:smoke   # prod
PUBLIC_API_URL=https://ak5-api-stg.ak5.workers.dev  pnpm test:smoke   # staging
```

It's **excluded from `pnpm test`** because it differs from the dev e2e suite in
two deployment-specific ways: it does **not** spoof `cf-connecting-ip` (real
Cloudflare 403s a client-set value, and the dev suite uses it for per-test
rate-limit isolation), and it makes only one register + one login so it stays
under the auth rate limits from a single real IP. It cleans up after itself
(`DELETE /me`), so it's safe to run against prod.

Email unit tests run in `pnpm test:unit`: native binding contract, mock capture,
redacted failures, REST diagnostic response handling, and authentication caller
failures. They send no real mail. Local/CI application tests must set
`EMAIL_MOCK_URL`. Live delivery checks require explicit intended recipients and
inbox confirmation; staging uses real email unless deliberately mocked/restricted.

## Native mobile

The pnpm workspace checks `@ak5/mobile` with Svelte/TypeScript and ESLint. Its
unit tests exercise secure-session handling, verification delivery failure,
resend/recovery, pagination and JSON validation using mock HTTP responses. The
`mobile` CI job bundles iOS and Android with one Metro worker (`pnpm build:mobile`).
Native compilation and device acceptance need the corresponding Xcode/Android
toolchains; see [mobile setup](../../packages/mobile/README.md).
