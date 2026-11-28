# ak5 web starter

An opinionated, MIT-licensed starter for web and native apps. Web and admin use
**React Router 8** and a **Hono** API on **Cloudflare Workers**. iOS and Android
use **React Native and Expo**.

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

- React Router 8 web and admin apps with Tailwind CSS and shared UI tokens.
- Hono RPC types shared with web, admin, mobile, and the development CLI.
- Email/password auth, email verification and recovery, optional Discord OAuth,
  role separation, and encrypted native session storage.
- Cloudflare Workers, R2, optional MCP with KV, and Cloudflare Email Sending, with React
  templates, a local email mock, and a template preview.
- React Native screens for iOS and Android, with Expo modules for secure storage
  and local SQLite.
- LiveStore local SQLite on web and mobile, with a Cloudflare D1 event log and
  Durable Object sync coordination.
- Drizzle migrations, unit tests, API integration tests, and Playwright tests.
- PR previews sharing development data, automatic hosted dev on `main`, and
  manual staging/production promotion with exact-commit qualification.

This is a starting point for your own application. You provide the database,
Cloudflare resources, verified email domain, and mobile signing configuration.

## Create your project

Install [mise](https://mise.jdx.dev) and Git, then create an independent, branded
project. The creator defaults to **website only**:

```sh
mise exec node@26.12.1 pnpm@12.15.0 -- pnpm dlx "github:ak5/web-starter#path:/packages/create" my-app --scope @myco --slug myapp
cd my-app
mise trust             # review and trust the generated configuration
mise install
pnpm install
pnpm dev:init
pnpm db:migrate
pnpm dev:auto
```

Add `--mobile` to include iOS/Android source or `--no-oauth` to omit Discord login.
Read `.env.dev-slot` for the selected local URLs. Local D1 needs no Cloudflare
account or database credentials; development email stays in the local inbox.

`pnpm mobile disable` removes native source and dependencies; `pnpm mobile enable`
restores them from the pinned starter revision. For that workflow, manual cloning
with shared Git history, and bringing in upstream fixes, see
[project creation and profiles](docs/development/start-project.md). See
[local setup](docs/development/setup.md) for the day-to-day commands.

## Native development

When enabled, the native app lives in `packages/mobile`. Install Xcode for iOS or the Android
SDK 37 and JDK 25 for Android, then follow [mobile setup](packages/mobile/README.md).
Start Metro with `pnpm dev:app`; use `pnpm app:ios` or `pnpm app:android` to run the
app. Native development is separate from the web stack.

## Packages

The starter repository contains these packages. Generated projects omit the
creator package; website-only projects also omit mobile.

| Package                   | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `@ak5/api`                | Hono API, authentication, database, OAuth, and cron     |
| `@ak5/web`                | React Router public app                                 |
| `@ak5/admin`              | React Router admin portal                               |
| `@ak5/create-web-starter` | Dependency-free project creator                         |
| `@ak5/mobile`             | React Native and Expo app for iOS and Android           |
| `@ak5/sync`               | Shared LiveStore schema, events, and HTTP sync client   |
| `@ak5/shared`             | Shared contracts and utilities                          |
| `@ak5/webui`              | Shared web components and React Router helpers          |
| `@ak5/email`              | Email templates, Cloudflare transport, mock and preview |
| `@ak5/cli`                | Development API client                                  |

## Checks and contributions

```sh
nice -n 10 pnpm check:all
nice -n 10 pnpm test:unit
nice -n 10 pnpm test:db
nice -n 10 pnpm test --workers=1  # requires a running local stack
```

Open short-lived PRs against `main`. Public fork PRs run checks without deployment
credentials; trusted same-repository PRs can receive previews sharing dev data. Database and browser
checks run against disposable local D1 databases without account credentials. See [contributing](docs/development/contributing.md),
[architecture](docs/architecture/overview.md), and the [documentation index](docs/index.md).

## Deployment

`main` is the development trunk. Merges deploy hosted dev; trusted PR previews
run their own code against dev data. This starter uses dev + production, without
stable staging. Forks can independently disable hosted dev or enable stable
staging. Staging and production deploy only through manually triggered workflows,
with the exact SHA qualified by the preceding enabled stage. Configure your own
GitHub environments, isolated data resources, secrets and branch protection
before enabling deployment. See [deployment](docs/operations/deployment.md).

Cloudflare Email Sending requires Workers Paid, manual activation, verified sender
DNS, and deployment-token permissions. Follow [email setup](docs/operations/email-sending.md)
for your own sender domain.

## License

[MIT](LICENSE). Preserve the copyright and permission notices when distributing
copies. Native bootstrap attribution is included in
[the upstream license](packages/mobile/UPSTREAM-LICENSE.txt).

The starter's MIT license covers its own code. Dependencies and copied upstream
code keep their own licenses and notices. Review the licenses of the packages
included in the artifacts you distribute; the root license does not replace them.

Made with <3 by [ak5](https://alexander.verver.is).

Web and admin production builds emit `third-party-licenses.txt` beside their
client assets. Keep that file with the deployed assets; it contains notices for
the dependencies Vite bundles. Native distribution also needs the notices for
its JavaScript and native dependencies. Inspect the installed workspace inventory
with `pnpm -r --include-workspace-root licenses list --json`, then match it to the
artifacts being shipped. Build tools in that inventory are not necessarily part
of the distributed application.
