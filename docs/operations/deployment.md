# Deployment

The stack deploys to **Cloudflare Workers** — one worker per surface — and
**GitHub Actions is the canonical deploy**. You don't run `wrangler deploy` by
hand: merges ship hosted development; staging and production require explicit promotion. The first deploy of each worker auto-creates it
on Cloudflare (wrangler + `account_id` + `name`), so there's no manual create step.

## One worker per surface

| Worker | Package      | Holds                                            |
| ------ | ------------ | ------------------------------------------------ |
| api    | `@ak5/api`   | DB, JWT issuance, OAuth callbacks, cron, secrets |
| web    | `@ak5/web`   | public SvelteKit surface                         |
| admin  | `@ak5/admin` | admin SvelteKit surface                          |

There is exactly **one api worker** regardless of how many frontend personas you
have. Each worker has its own `wrangler.jsonc`.
The Workers runtime compatibility date is `2026-10-23`. Regenerate binding types
with `pnpm gen` after runtime or binding changes, and verify against local D1
before deployment.

**Service binding (required on Cloudflare).** web/admin reach the api worker
**server-side** (loaders/actions). Cloudflare blocks a Worker from fetching
another Worker on the same account over a public URL (error 1042), so web/admin
each bind the api worker as a service (`services: [{ binding: "API", … }]` in
their `wrangler.jsonc`, pointing at `ak5-api` for production, `ak5-api-stg` for
development, or `ak5-api-staging` for stable staging). `src/lib/api.ts` routes server-side calls through that binding (via
`getRequestEvent().locals.apiFetch`, populated by the server hook from `cloudflare:workers`) and falls back to the public `PUBLIC_API_URL`
fetch in dev/browser. Without the binding, every SSR api call (login, data loads)
fails on Cloudflare.

## Branch & environment model

`main` is the only long-lived development branch. Create short-lived feature
branches from it and open PRs into `main`. Require `quality-gates` and
`migrate-check`, disable direct and force pushes, and use rebase-and-merge for
feature PRs. Production promotion does not create a commit or move a branch.
There is no release branch and no deployment prerequisite on merges into trunk.

**This starter's profile: hosted development + production, without stable staging.**

| Event                                                 | Environment    | Target                                            |
| ----------------------------------------------------- | -------------- | ------------------------------------------------- |
| Trusted same-repository PR into `main`                | PR preview     | `ak5-{api,web,admin}-pr-<number>.ak5.workers.dev` |
| Merge to `main`, after CI                             | Development    | `ak5-{api,web,admin}-stg.ak5.workers.dev`         |
| Manual `promote.yml`, target `staging` (when enabled) | Stable staging | `ak5-{api,web,admin}-staging.ak5.workers.dev`     |
| Manual `promote.yml`, target `production`             | Production     | `api/www/admin.<PROD_DOMAIN>`                     |

Development follows trunk and can change throughout the day. Stable staging
holds a chosen release candidate until an operator explicitly promotes another
SHA. Production holds its own manually selected release. Each has separate
Workers, data bindings and runtime secrets; previews intentionally share dev's
resources. Do not put production data in development.

Worker names are resource identities, independent of environment labels. This
repository's development Workers use the `-stg` names configured in
`env.development`; stable staging uses separate `-staging` Workers. Keep existing
Worker names when configuring an environment to preserve runtime secrets and
Durable Object namespaces. Fork owners may choose their own names and URLs.

### Choose the environments you need

Set these **repository variables**, rather than dispatch inputs, so a production
operator cannot skip an enabled qualification stage for one release:

| `HOSTED_DEV`     | `ENABLE_STAGING`  | Promotion path                                          |
| ---------------- | ----------------- | ------------------------------------------------------- |
| `true` (default) | `false` (default) | CI → automatic dev → manual production                  |
| `true`           | `true`            | CI → automatic dev → manual staging → manual production |
| `false`          | `true`            | CI → manual staging → manual production                 |
| `false`          | `false`           | CI → manual production                                  |

A missing `HOSTED_DEV` means enabled; only the literal `false` disables it.
Stable staging is enabled only by literal `ENABLE_STAGING=true`. PR deployments
are disabled with hosted dev, because they depend on its data and sync service.
Local development and credential-free PR CI remain available in every profile.

`development.yml` runs all reusable CI checks on every trunk push, including
published documentation changes. If hosted dev is enabled, it then deploys the
exact push SHA. Dev deploys serialize without cancelling a running rollout.

### Manually promote a release

Use GitHub Actions → **promote** → **Run workflow**, choose `main`, select the
target environment, and enter a full 40-character commit SHA. Or run:

```sh
# Optional stable staging, after enabling and provisioning it:
gh workflow run promote.yml --ref main -f target=staging -f sha=<full-main-sha>
# Production:
gh workflow run promote.yml --ref main -f target=production -f sha=<full-main-sha>
```

The gate requires the selected SHA to belong to `main` and to have passed the
preceding enabled stage. With stable staging enabled, production always requires
that **same SHA** to have been successfully deployed to staging. Otherwise it
requires dev, or trunk CI when neither non-production environment is enabled.
Previews, failed/skipped deployments, and successful workflows for a different
SHA do not qualify.

After migrations, API/web/admin deployment, secret sync and frontend smoke
checks all succeed, the deploy job uploads a `deployment-<environment>-<sha>`
receipt. The gate checks its trusted workflow, trigger, main branch, successful
deploy job, exact SHA and unexpired receipt. A manual workflow's own main SHA
may differ from the candidate it checks out, so its run SHA alone is insufficient.
Receipts expire after 90 days; revalidate/redeploy an old candidate before
promotion. The first release must include these workflows and receipts; run CI
and deploy dev before trying to promote it.

Promotions serialize per destination. Each environment builds the same source SHA
and locked dependencies with its own configuration and secrets. This promotes
**source revisions**, not a byte-identical bundle or a Cloudflare version ID
between separately configured Workers. Database contents and schema are not
rolled back by changing code versions. To roll back code, manually promote a
previously qualified SHA that still supports the current database schema.

### Fully functional PR previews on development data

`preview.yml` deploys the PR head to dedicated API, web and admin Workers. It
rewrites the frontend service bindings and public URLs to that PR's API, so SSR
and browser requests run the PR's code. It uses the **Dev Cloudflare** environment's
D1 database, KV, R2 and secrets. **Preview writes affect development.**
Previews do not apply migrations; merge additive schema changes into trunk and
let dev apply them before testing code that needs them.

PRs also bind to development's `NotesSync` Durable Object. Sharing D1 requires
one ordering authority per notes store. The preview API and frontend code are
independent, but notes coordinator code comes from dev: changes to that code
must reach dev before previews can exercise it. Never create two independent
sync namespaces for the same D1 stores.

Only trusted same-repository PRs receive deployment credentials; fork and
Dependabot PRs run CI without live previews. URLs appear in the Actions summary.
`preview-cleanup.yml` checks out trusted main code when a PR closes and deletes
only its three Workers, leaving shared data and dev's sync namespace intact.

Cloudflare version URLs share the uploaded version's configured resources, but
are not generated for Workers that implement a Durable Object. This API exports
`NotesSync`, so the starter uses separate PR Workers. New Cloudflare Previews
also need explicit multi-Worker service routing and a decision about their
isolated Durable Object namespaces before they can replace this shared-data
setup. See [version URL limits](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
and [Preview configuration](https://developers.cloudflare.com/workers/previews/configuration/).

### Environment banners

Web and admin use the same dismissible banner. Development is labelled
`Development`, stable staging `Staging`, and PRs `Preview PR #<number>`.
Production has an empty label and shows none. Set `PUBLIC_ENV_BANNER=false` in
the selected frontend Wrangler environment to turn it off; local `.env` accepts
the same setting. `PUBLIC_DEPLOY_ENVIRONMENT` controls the displayed label.
Dismissal is in component memory only: every completed SvelteKit navigation and
full page reload restores the banner. Nothing is stored in cookies or storage.

## D1 and account setup

Create separate databases for each enabled environment in the consuming app's own
Cloudflare account. Use `pnpm wrangler d1 create <your-app-dev>` and repeat for
staging (if enabled) and production. Their UUIDs are resource identifiers, not database passwords. Keep
account/domain IDs out of starter defaults.

Create **Dev Cloudflare** when hosted dev is enabled, **Staging Cloudflare**
when stable staging is enabled, and **Prod Cloudflare** for production. Set
`D1_DATABASE_ID` separately in each GitHub Environment. `scripts/configure-d1.mjs` rejects placeholder IDs and wires
the selected environment's ID before deployment. Previews use development's ID.
The API alone has a native `DB` binding. Local Wrangler uses the committed
placeholder IDs for local persistence and never reaches a remote database.

Create KV namespaces and R2 buckets and configure the matching bindings in
`packages/api/wrangler.jsonc`. Use separate production, development and staging KV namespaces and R2 buckets;
only PR previews intentionally share development resources. Set each non-production environment's `R2_PUBLIC_URL` to its bucket's HTTPS public URL.
The workflow writes it to the API's `PUBLIC_R2_URL`; production uses its configured CDN domain. Create the GitHub Environments before enabling deployments.

| Setting                 | Kind / scope                        | Purpose                                          |
| ----------------------- | ----------------------------------- | ------------------------------------------------ |
| `DEPLOY_WORKERS=true`   | repository variable                 | Enable Worker deployment jobs                    |
| `HOSTED_DEV=true`       | repository variable                 | Automatic dev + shared-data PR previews          |
| `ENABLE_STAGING=false`  | repository variable                 | Require manual stable staging before production  |
| `D1_DATABASE_ID`        | environment variable                | This environment's actual D1 UUID                |
| `CLOUDFLARE_ACCOUNT_ID` | environment variable                | Consuming app's Cloudflare account               |
| `KV_NAMESPACE_ID`       | environment variable                | API KV namespace                                 |
| `R2_PUBLIC_URL`         | non-production environment variable | HTTPS public URL of this environment's R2 bucket |
| `EMAIL_FROM`            | environment variable                | Verified sender address                          |
| `PROD_DOMAIN`           | production environment variable     | App domain, without protocol                     |
| `CLOUDFLARE_API_TOKEN`  | environment secret                  | Deployment token                                 |
| `JWT_SECRET`            | environment secret                  | Shared by API, web and admin in this environment |
| `TOKEN_ENCRYPTION_KEY`  | environment secret                  | API encryption key                               |
| `DISCORD_CLIENT_SECRET` | optional environment secret         | OAuth provider secret                            |

Bootstrap in this order:

1. Rebrand the starter, choose the profile above, and provision its D1 databases,
   KV namespaces, R2 buckets and optional public asset domains.
2. Fill `env.development`, optional `env.staging`, and production bindings in
   the three Wrangler configs. Update the example `ak5.workers.dev` URLs to your
   account's actual subdomain; keep frontend API service bindings aligned.
3. Create the enabled GitHub Environments and add the variables/secrets above.
   Use independent JWT/encryption keys for each data environment. Restrict prod
   and staging dispatches to main, and optionally add required reviewers.
4. Set `HOSTED_DEV` and `ENABLE_STAGING` for your chosen profile, then enable
   `DEPLOY_WORKERS=true`. Merge the workflow setup into main and wait for CI and
   the enabled dev deployment. Provision dev before opening live PR previews.
5. Check login, notes sync and a real application-generated email in dev. Promote
   that exact SHA through the enabled stages using the manual workflow.

Give the deployment token only the account/zone permissions needed for these
resources: Worker scripts and routes, D1 edit, KV, R2 and Email Sending edit.
Runtime D1 uses a native binding; do not copy the deployment token into the Worker.
Complete [Email Sending onboarding](email-sending.md) for your verified domain
before enabling sends. Local setup uses the mock.

`deploy-workers.yml` applies committed D1 migrations with `--remote` to the selected
environment before deploying the API. Web/admin use API service bindings and only
hold the shared JWT secret. GitHub environment secrets override Worker values on
deploy. When an override is absent, deployment verifies that each required secret
already exists and keeps its value. This preserves sessions and encrypted data
when deployment ownership moves between repositories. The JWT must match across
all three Workers; secret names alone do not prove matching values. Production promotion requires the preceding enabled stage. Configure production
and stable staging GitHub Environments to accept only `main`. Dev must also allow
PR workflow refs for previews; GitHub environment branch policies match the
workflow ref, not the SHA checked out by a step.

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
Provision development before PR previews: previews bind to development's `NotesSync`
script as well as its database, keeping one ordering authority per store. Never
point a second independent sync namespace at the same stores in D1. Production and optional stable staging each keep their own namespace and D1 database. See [local-first notes](../architecture/local-first.md).
