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

## D1 and account setup

Create separate databases for staging and production in the consuming app's own
Cloudflare account. Use `pnpm wrangler d1 create <your-app-staging>` and repeat for
production. Their UUIDs are resource identifiers, not database passwords. Keep
account/domain IDs out of starter defaults.

Set `D1_DATABASE_ID` separately in the **Staging Cloudflare** and **Prod Cloudflare**
GitHub Environments. `scripts/configure-d1.mjs` rejects placeholder IDs and wires
the selected environment's ID before deployment. Previews use staging's ID.
The API alone has a native `DB` binding. Local Wrangler uses the committed
placeholder IDs for local persistence and never reaches a remote database.

Create KV namespaces and R2 buckets and configure the matching bindings in
`packages/api/wrangler.jsonc`. Choose distinct production/staging resources when
you need isolation. Create the GitHub Environments before enabling deployments.

| Setting                 | Kind / scope                    | Purpose                                           |
| ----------------------- | ------------------------------- | ------------------------------------------------- |
| `DEPLOY_WORKERS=true`   | repository variable             | Enable staging, preview and promotion deployments |
| `D1_DATABASE_ID`        | environment variable            | This environment's actual D1 UUID                 |
| `CLOUDFLARE_ACCOUNT_ID` | environment variable            | Consuming app's Cloudflare account                |
| `KV_NAMESPACE_ID`       | environment variable            | API KV namespace                                  |
| `EMAIL_FROM`            | environment variable            | Verified sender address                           |
| `PROD_DOMAIN`           | production environment variable | App domain, without protocol                      |
| `CLOUDFLARE_API_TOKEN`  | environment secret              | Deployment token                                  |
| `JWT_SECRET`            | environment secret              | Shared by API, web and admin in this environment  |
| `TOKEN_ENCRYPTION_KEY`  | environment secret              | API encryption key                                |
| `DISCORD_CLIENT_SECRET` | optional environment secret     | OAuth provider secret                             |

Give the deployment token only the account/zone permissions needed for these
resources: Worker scripts and routes, D1 edit, KV, R2 and Email Sending edit.
Runtime D1 uses a native binding; do not copy the deployment token into the Worker.
Complete [Email Sending onboarding](email-sending.md) for your verified domain
before enabling sends. Local setup uses the mock.

`deploy-workers.yml` applies committed D1 migrations with `--remote` to the selected
environment before deploying the API. Web/admin use API service bindings and only
hold the shared JWT secret. Production promotion reuses a main SHA already
deployed successfully to staging. Configure production's GitHub Environment to
accept only `main`.

`migrate-check.yml` runs without credentials: validate the Drizzle journal and
apply local migrations twice. It proves fresh-database setup and repeat safety;
it does not prove compatibility with every possible production data set. Use
additive migrations, backup/Time Travel, and a reviewed data migration for
non-additive changes.

## Bootstrap an admin

For local D1:

```sh
pnpm create:admin admin@example.com adminname '<strong-password>'
```

For a configured remote D1 database, authenticate Wrangler, set `D1_DATABASE_ID`
to the intended target, and add `--remote` to the same command. The flag is
explicit and uses the target D1 remote binding. Protect shell history and never
commit a bootstrap password. The script creates or updates the email credential
with an atomic batch and prints only the public ID. It is operator tooling, not
a public bootstrap endpoint.

## Observability and recovery

Watch Worker logs and D1 query metrics. Index high-volume filters so billed rows
read/written reflect the intended access path. Review current
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and
[Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
Worker rollback does not roll back the database schema. Keep forward-compatible
migrations and a separate database recovery plan.

## LiveStore sync

The API binds `NOTES_SYNC` to the exported SQLite Durable Object `NotesSync` and
registers its migration. Its event storage uses the API's `DB` D1 binding. No
additional runtime credential is needed. Deployment tokens need permission to
manage the Worker's Durable Object bindings in addition to D1/Worker deployment.
Provision staging before PR previews: previews bind to staging's `NotesSync`
script as well as its database, keeping one ordering authority per store. Never
point a second independent sync namespace at the same stores in D1. Production
keeps its own namespace and D1 database. See [local-first notes](../architecture/local-first.md).
