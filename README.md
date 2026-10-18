# ak5 web starter

An opinionated, MIT-licensed starter for web and native apps: **SvelteKit 3**,
**Hono**, and **Svelte 5 on Symbiote Native / React Native**, deployed on
**Cloudflare Workers**.

One typed API serves a public web app, an admin portal, and iOS/Android apps.
The database is **Cloudflare D1 with Drizzle**. **LiveStore** gives web and native
notes local SQLite storage with offline edits and sync to D1. Identity and the
online items example use the typed Hono API. See [local-first notes](docs/architecture/local-first.md)
for storage, authentication, and offline limits.

## Why Cloudflare?

We think Cloudflare is the best deal in the hosting and tech space for this kind
of app. Workers, D1, KV, R2, and Email Sending keep the backend on one platform,
with local development through Wrangler and no separately hosted database server.
That is an opinion, not a promise about every workload: index your queries and
check the current [Workers](https://developers.cloudflare.com/workers/platform/pricing/)
and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and limits
for your application's read, write, storage, and CPU usage.

## What's included

- SvelteKit 3 web and admin apps with Tailwind CSS and DaisyUI.
- Hono RPC types shared with web, admin, mobile, and the development CLI.
- Email/password auth, email verification and recovery, optional Discord OAuth,
  role separation, and encrypted native session storage.
- Cloudflare Workers, KV, R2, and native Cloudflare Email Sending, with a local
  email mock and template preview.
- Svelte 5 native screens on Symbiote Native and React Native for iOS/Android.
- LiveStore local SQLite on web and mobile, with a Cloudflare D1 event log and
  Durable Object sync coordination.
- Drizzle migrations, unit tests, API integration tests, and Playwright tests.
- PR previews sharing staging data, automatic staging on `main`, and manual
  production promotion of a commit already deployed to staging.

This is a starting point for your own application. You provide the database,
Cloudflare resources, verified email domain, and mobile signing configuration.

## Create your project

Install [mise](https://mise.jdx.dev), Git, and create an empty repository for your
application. Clone this starter as a normal repository, then keep it as `upstream`
so you can bring in future fixes. A GitHub fork is not required.

```sh
git clone https://github.com/ak5/web-starter.git myapp
cd myapp
git remote rename origin upstream
git remote add origin git@github.com:YOUR_ORG/YOUR_REPO.git
mise trust             # review and trust this checkout
mise install
pnpm install
pnpm rebrand --scope @myco --slug myapp
pnpm dev:init
```

`rebrand` replaces the starter's brand tokens. Add `--no-oauth` to omit the
Discord login overlay, or skip rebranding to keep the defaults. It deletes its
own initializer after running.

Apply the schema to local D1 and launch. Local database development needs no
Cloudflare account or database credentials:

```sh
pnpm db:migrate
pnpm dev:auto
```

Read `.env.dev-slot` for your selected local URLs. The API, web, admin, and email
preview run behind Caddy; the email mock keeps development mail local.
See [local setup](docs/development/setup.md) for prerequisites and configuration.

Commit your application changes and push to your new origin:

```sh
git add .
git commit -m "Initialize my application"
git push -u origin main
```

### Bring in starter updates

Keep starter updates separate from your product work and review them on a branch:

```sh
git fetch upstream
git switch -c chore/starter-update
git merge upstream/main
# Resolve conflicts, review changes, and run the checks below.
git push -u origin chore/starter-update
```

Open a PR in your own repository. Updates are ordinary Git merges; changes to
branded files, removed packages, or your product features can require manual
conflict resolution. Keep the shared history so future merges can identify what
has already been applied.

## Native development

The native app lives in `packages/mobile`. Install Xcode for iOS or the Android
SDK and JDK 21 for Android, then follow [mobile setup](packages/mobile/README.md).
Start Metro with `pnpm dev:app`; use `pnpm app:ios` or `pnpm app:android` to run the
app. Native development is separate from the web stack.

## Packages

| Package       | Purpose                                                 |
| ------------- | ------------------------------------------------------- |
| `@ak5/api`    | Hono API, authentication, database, OAuth, and cron     |
| `@ak5/web`    | SvelteKit public app                                    |
| `@ak5/admin`  | SvelteKit admin portal                                  |
| `@ak5/mobile` | Svelte / Symbiote Native / React Native app             |
| `@ak5/sync`   | Shared LiveStore schema, events, and HTTP sync client   |
| `@ak5/shared` | Shared contracts and utilities                          |
| `@ak5/webui`  | Shared web components and SvelteKit helpers             |
| `@ak5/email`  | Email templates, Cloudflare transport, mock and preview |
| `@ak5/cli`    | Development API client                                  |

## Checks and contributions

```sh
nice -n 10 pnpm check:all
nice -n 10 pnpm test:unit
nice -n 10 pnpm test:db
nice -n 10 pnpm test --workers=1  # requires a running local stack
```

Open short-lived PRs against `main`. Public fork PRs run checks without deployment
credentials; trusted same-repository PRs can receive staging previews. Database and browser
checks run against disposable local D1 databases without account credentials. See [contributing](docs/development/contributing.md),
[architecture](docs/architecture/overview.md), and the [documentation index](docs/index.md).

## Deployment

Configure your own GitHub environments, Cloudflare resources, and separate staging/production D1 databases
before enabling deployments. GitHub-hosted runners run CI. Merges to `main` deploy
staging; production requires manual promotion of a SHA with a successful staging
deployment. See [deployment](docs/operations/deployment.md).

Cloudflare Email Sending requires Workers Paid, manual activation, verified sender
DNS, and deployment-token permissions. Follow [email setup](docs/operations/email-sending.md)
for your own sender domain.

## License

[MIT](LICENSE). Preserve the copyright and permission notices when distributing
copies. Native bootstrap attribution is included in
[the upstream license](packages/mobile/UPSTREAM-LICENSE.txt).

Made with <3 by [ak5](https://alexander.verver.is).
