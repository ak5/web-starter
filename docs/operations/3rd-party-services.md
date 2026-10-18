# Third-party services

The external services the platform depends on, and the env keys that wire them up.
All data-touching keys live **only** in the api package's environment (see
[deployment.md](deployment.md)); web/admin never hold them.

## Postgres (Neon)

The api persists to a [Neon](https://neon.tech) serverless Postgres database via
Drizzle. Provision two branches:

- a **production** branch — the live database.
- a **test** branch — wiped and re-migrated by the e2e suite, so it must be a
  separate branch from production.

| Env key             | Where  | Purpose                                   |
| ------------------- | ------ | ----------------------------------------- |
| `DATABASE_URL`      | api    | production connection string              |
| `DATABASE_URL_TEST` | api/CI | test-branch connection string (e2e wipes) |

Run forward-only migrations with `pnpm db:migrate`.

## Transactional email

The `@ak5/email` package renders verification, password reset, magic-link reauth,
and invite templates. Deployed API Workers send through **Cloudflare Email
Sending**, using the native `EMAIL` binding. No runtime email API token is needed.

In dev and CI, `EMAIL_MOCK_URL` points to the local mock, which captures outbound
mail; the preview server renders templates. Staging sends real mail unless
explicitly mocked or recipient-restricted.

Follow [email-sending.md](email-sending.md) for Workers Paid billing, manual
service enablement, sender-domain onboarding, DNS records, deployment-token
permissions, and application inbox verification. Each consuming app must verify
its own sender; starter defaults do not establish readiness.

| Binding / env key   | Where | Purpose                                                   |
| ------------------- | ----- | --------------------------------------------------------- |
| `EMAIL`             | api   | Native `send_email` binding, declared in each environment |
| `PUBLIC_EMAIL_FROM` | api   | Verified sender matching the binding allowlist            |
| `EMAIL_MOCK_URL`    | api   | Local-only mock capture URL; unset when sending live      |

Cloudflare processes recipient addresses and transactional content. Consuming
apps must reflect that in their privacy notices and processor disclosures.

## OAuth login providers

OAuth login (Discord is bundled; others follow the same recipe) is a **removable
overlay** — the email + password core never imports it, so it can be deleted
without breaking auth. Each provider needs a client id + secret and a registered
callback URL. The callback URL points
at the api worker: `https://api.ak5web.com/auth/oauth/<provider>/callback` in prod
(`api.ak5.localhost:8359` in dev). Register both the dev and prod callbacks in the
provider console.

| Env key                 | Where | Purpose                    |
| ----------------------- | ----- | -------------------------- |
| `DISCORD_CLIENT_ID`     | api   | Discord OAuth app id       |
| `DISCORD_CLIENT_SECRET` | api   | Discord OAuth app secret   |
| `GOOGLE_CLIENT_ID`      | api   | Google OAuth client id     |
| `GOOGLE_CLIENT_SECRET`  | api   | Google OAuth client secret |

Provider secrets are api-only. If you drop the OAuth overlay, drop these keys too.
