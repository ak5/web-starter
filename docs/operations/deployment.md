# Deployment

The stack deploys to **Cloudflare Workers** — one worker per surface — and
**GitHub Actions is the canonical deploy**. You don't run `wrangler deploy` by
hand: merges ship staging and production requires explicit promotion. The first deploy of each worker auto-creates it
on Cloudflare (wrangler + `account_id` + `name`), so there's no manual create step.

## One worker per surface

| Worker | Package      | Holds                                            |
| ------ | ------------ | ------------------------------------------------ |
| api    | `@ak5/api`   | DB, JWT issuance, OAuth callbacks, cron, secrets |
| web    | `@ak5/web`   | public SvelteKit surface                         |
| admin  | `@ak5/admin` | admin SvelteKit surface                          |

There is exactly **one api worker** regardless of how many frontend personas you
have. Each worker has its own `wrangler.jsonc`.

**Service binding (required on Cloudflare).** web/admin reach the api worker
**server-side** (loaders/actions). Cloudflare blocks a Worker from fetching
another Worker on the same account over a public URL (error 1042), so web/admin
each bind the api worker as a service (`services: [{ binding: "API", … }]` in
their `wrangler.jsonc`, pointing at `ak5-api` for prod / `ak5-api-stg` for
staging). `src/lib/api.ts` routes server-side calls through that binding (via
`getRequestEvent().locals.apiFetch`, populated by the server hook from `cloudflare:workers`) and falls back to the public `PUBLIC_API_URL`
fetch in dev/browser. Without the binding, every SSR api call (login, data loads)
fails on Cloudflare.

## Branch & environment model

| Event                              | Environment | Target                                                             |
| ---------------------------------- | ----------- | ------------------------------------------------------------------ |
| Same-repository PR into `main`     | Preview     | Separate `ak5-{api,web,admin}-pr-<number>.ak5.workers.dev` Workers |
| Merge to `main`, after CI succeeds | Staging     | `ak5-{api,web,admin}-stg.ak5.workers.dev`                          |
| Manual `promote.yml` from `main`   | Production  | Custom domains `api/www/admin.<PROD_DOMAIN>`                       |

Use short-lived feature branches from `main` and PR directly into `main`.
Require `quality-gates` and `migrate-check` on the protected trunk. No integration
branch or release PR is needed.

`staging.yml` runs the reusable `test.yml`, then `deploy-workers.yml` for the exact
main SHA. Every merge is tested and staged, including documentation-only merges.
Staging deploys serialize without cancelling an in-progress rollout. Deployment
requires both frontend login pages to respond successfully after secret sync.

`promote.yml` accepts a full 40-character commit SHA. It must run from `main`.
The gate verifies the SHA is an ancestor of main and finds a successful `staging.yml`
push run for that SHA with a successful `deploy / deploy` job. Skipped deployments,
failed runs, PR previews and commits outside main cannot qualify. Production
promotions serialize and use the same locked dependencies and build commands as
staging, with production configuration and secrets.

```sh
gh workflow run promote.yml --ref main -f sha=<full-staged-commit-sha>
```

`preview.yml` deploys PR code to dedicated Workers and rewires their service
bindings and public URLs to the PR API. It syncs staging secrets to those Workers;
they share the staging database, KV and R2 resources. **Preview writes affect staging.**
Never put production data in staging. Only trusted same-repository PRs receive
secrets; fork PRs have no live preview. URLs appear in the Actions summary.
`preview-cleanup.yml` runs trusted main code when the PR closes and deletes its
three Workers; it does not delete shared data. Previews do not run migrations.
Schema-dependent previews need an additive schema change staged first.

`migrate-check.yml` validates schema changes on an ephemeral Neon branch of
production data before merging, then deletes the temporary branch.

## Repository enforcement

Keep the default branch `main`, require PRs, `quality-gates`, and `migrate-check`,
and disable force pushes/deletion. The production GitHub Environment should allow
only `main`; staging must also allow PR refs for previews. Keep environment secrets
separate and never make production credentials available to preview jobs.

## Secrets — two kinds

Deployment uses **two** distinct secret stores; don't confuse them.

1. **GitHub Actions secrets/variables** — the single source of truth. Per-env
   secrets live in **GitHub Environments** (`Prod Cloudflare` / `Staging Cloudflare`):
   - `CLOUDFLARE_API_TOKEN` (env-scoped) — deploy + secret-sync auth.
   - `DATABASE_URL` (env-scoped) — the env's Neon branch, **pooled** (`-pooler`); the
     api Worker's runtime connection (synced onto the Worker).
   - `DATABASE_URL_DIRECT` (env-scoped) — the same branch **unpooled** (no `-pooler`);
     used only by the migrate step (Neon recommends a direct connection for DDL /
     advisory locks). Optional — the migrate step falls back to `DATABASE_URL`.
   - `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY` (env-scoped) — synced onto the Workers.
   - `DISCORD_CLIENT_SECRET` (env-scoped, optional) — synced if set.
   - `NEON_API_KEY` (repo-level) — `migrate-check` + the DB-backed `test.yml` jobs.
   - `JWT_SECRET` (repo-level) — the e2e job (`test.yml` runs with no environment, so
     it can't see the env-scoped one).
   - Variables: `DEPLOY_WORKERS`, `RUN_MIGRATIONS` (gates), `NEON_PROJECT_ID`,
     `NEON_PROD_BRANCH` (migrate-check fork parent).

2. **Cloudflare Worker runtime secrets** — read by the worker at runtime, but you
   **never run `wrangler secret put` by hand**. They live in the **same GitHub
   Environments** above; `deploy-workers.yml` syncs them onto the Workers on every deploy
   (`scripts/sync-cloudflare-worker-secrets.sh`, run after deploy so the first run
   can auto-create the Workers; idempotent thereafter). The division is load-bearing:
   - **`JWT_SECRET`** — pushed to **all three** workers from one env secret, so it's
     **identical within an env** (api signs cookies; web/admin verify). Rotating it
     is a global logout. Use a **different** value per env (a staging leak shouldn't
     forge prod cookies).
   - **api only** — `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, and provider secrets
     (`DISCORD_CLIENT_SECRET`). Web/admin **never** get a
     data-touching secret.
   - **Previews** receive staging secrets through the same sync script.
     Rotate secrets in the GitHub Environment and redeploy affected Workers.

## Cookie domains: prod vs staging

`COOKIE_ORIGIN` (api) / `PUBLIC_COOKIE_ORIGIN` (web/admin) control the cookie
`Domain` + `Secure` attributes (see `packages/shared/src/cookie.ts`):

- **Prod** = `.ak5web.com` (dotted, HTTPS) → `Domain` is set (cookies span
  `api`/`www`/`admin` subdomains → cross-app SSO) **and** `Secure`.
- **Staging** = `""` (empty) → **host-only + Secure** cookies. `workers.dev` is on
  the Public Suffix List, so sibling `*-stg.ak5.workers.dev` hosts **can't** share
  a cookie domain — each staging app logs in independently. This is fine for
  staging/previews; the api and the Playwright `api` project work fully.

  > Opt-in for true staging SSO: give staging its own custom subdomains
  > (`*-staging.ak5web.com`) and set the staging `COOKIE_ORIGIN`/`PUBLIC_COOKIE_ORIGIN`
  > to `.ak5web.com`.

## Database migrations

Migrations run automatically in `deploy-workers.yml` (gated on `vars.RUN_MIGRATIONS`)
against the env's `DATABASE_URL`, **before** the api ships — schema always leads
code. `migrate-check.yml` proves they apply cleanly against a fork of prod data
before merge. See [../development/contributing.md](../development/contributing.md)
for the additive-only / 2-PR-drop / 3-PR-rename policy.

## Compatibility flags

All three workers share a `compatibility_date` and the **`nodejs_compat`** flag in
`wrangler.jsonc`. Keep these aligned across the workers when you bump them.

## One-time setup checklist

Run **once** after forking (and rebranding), with `gh` and `wrangler` logged in
(use your own account and resource values).
After this, the push-to-deploy flow above is fully automatic.

```sh
# 1. Bindings + IDs
wrangler kv namespace create ak5     # → KV namespace id
wrangler r2 bucket create ak5
#   Wire the KV id either by pasting it into packages/api/wrangler.jsonc, OR (best
#   for the auto-synced example, since a sync would overwrite the file):
#     gh variable set KV_NAMESPACE_ID --body <id>   # deploy-workers.yml injects it
#   account_id auto-detects from a single-account API token (else set it in
#   wrangler.jsonc / CLOUDFLARE_ACCOUNT_ID). Confirm the staging vars use your
#   workers.dev subdomain.

# 2. GitHub Environments + secrets/variables. These ARE the Worker runtime
#    secrets — deploy-workers.yml syncs them onto the Workers; there is NO manual
#    `wrangler secret put`. CLOUDFLARE_API_TOKEN scope: Workers Scripts:Edit,
#    Routes:Edit, Zone:Edit.
gh api -X PUT repos/:owner/:repo/environments/"Prod Cloudflare"
gh api -X PUT repos/:owner/:repo/environments/"Staging Cloudflare"
for ENV in "Prod Cloudflare" "Staging Cloudflare"; do
  gh secret set CLOUDFLARE_API_TOKEN --env "$ENV"
  gh secret set DATABASE_URL         --env "$ENV"   # pooled (-pooler) — Worker runtime
  gh secret set DATABASE_URL_DIRECT  --env "$ENV"   # same branch, unpooled — migrations
  openssl rand -hex 32 | gh secret set JWT_SECRET           --env "$ENV"   # one per env
  openssl rand -hex 32 | gh secret set TOKEN_ENCRYPTION_KEY --env "$ENV"
  # optional (synced only if set):
  # gh secret set DISCORD_CLIENT_SECRET --env "$ENV"
done
gh secret set NEON_API_KEY                              # repo-level (migrate-check + test.yml)
openssl rand -hex 32 | gh secret set JWT_SECRET         # repo-level (e2e job only)
gh variable set CLOUDFLARE_ACCOUNT_ID --body <your-account-id>
gh variable set EMAIL_FROM --body <verified-sender-address>
gh variable set DEPLOY_WORKERS   --body true
gh variable set RUN_MIGRATIONS   --body true
gh variable set NEON_PROJECT_ID  --body <neon-project-id>
gh variable set NEON_PROD_BRANCH --body <neon-prod-branch-id>   # migrate-check fork parent
gh variable set PROD_DOMAIN      --body <your-domain>           # prod binds api/www/admin/cdn.<it> as
#   custom domains on that Cloudflare zone; deploy-workers.yml seds __PROD_DOMAIN__ in wrangler.jsonc. Omit
#   for staging-only (workers.dev). Must be a zone on your CF account.

# 3. (No manual Worker secrets — deploy-workers.yml runs
#    scripts/sync-cloudflare-worker-secrets.sh, pushing the GitHub Environment
#    secrets above onto the Workers on every deploy.)

# 4. Protect main: require PRs, quality-gates and migrate-check.
#    In GitHub Settings → Environments → Prod Cloudflare, restrict deployment
#    branches to main. Keep Staging Cloudflare available to trusted PR previews.

```

Until `vars.DEPLOY_WORKERS` is `true`, the deploy/preview workflows no-op, so a
fresh fork stays green before Cloudflare is wired.

## Transactional email readiness

Before the first deployment, follow [Cloudflare Email Sending setup](email-sending.md):
Workers Paid, manual Email Sending enablement, the consuming app's verified sender
domain, and Email Sending:Edit on the deployment token are required. The API's
native `EMAIL` binding is declared separately for production and staging; no
runtime email API token is synced. `EMAIL_FROM` is a GitHub repository/Environment variable holding the verified
sender address; deploy and preview workflows use it for `PUBLIC_EMAIL_FROM` and
`allowed_sender_addresses`, independently of the website domain. Staging sends real
mail unless explicitly mocked or restricted. Verify an application message in a
consented inbox on staging and production before considering the migration live.

## Native mobile application

The mobile app is Svelte on Symbiote Native / React Native. Backend PR previews
and staging/production promotion follow the Worker workflows above. Mobile
binaries are distributed separately with app-specific signing and store setup;
release launch commands require explicit HTTPS `MOBILE_API_URL` and `MOBILE_WEB_URL`. CI produces
JavaScript bundle checks for both platforms, not store-ready signed binaries.
See [native setup](../../packages/mobile/README.md).
