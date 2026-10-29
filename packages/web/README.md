# @ak5/web

SvelteKit on Cloudflare Workers — the public app surface. A pure UI worker: it
owns no DB, verifies the JWT cookie and checks its session with the API, then talks to `@ak5/api` through the
typed Hono client in `#lib/api` (`hc<WebApiType>`). Auth flows are wired through
`@ak5/webui`'s action helpers.

This ships a **minimal example surface** — replace it with your product, keep the
auth wiring.

## Routes

| Route                 | Auth                   | Purpose                                |
| --------------------- | ---------------------- | -------------------------------------- |
| `/`                   | public                 | Starter overview and author credit     |
| `/login`              | guest                  | Sign in (email + password)             |
| `/register`           | guest                  | Create an account                      |
| `/account/verify`     | user                   | Enter verification code or resend      |
| `/dashboard`          | user                   | Authed example dashboard (protected)   |
| `/notes`              | user                   | Local SQLite notes with LiveStore sync |
| `/sync`               | user                   | POST proxy to the API sync service     |
| `/logout`             | user                   | Clear the session (POST) → `/`         |
| `/forgot-password`    | public                 | Request a reset link by email          |
| `/account/password`   | session or reset token | Set, reset or change password          |
| `/invite`             | public                 | Open the invitation password form      |
| `/auth/magic/[token]` | session                | Confirm a reauthentication link        |
| `/items`              | session                | Example item list and CRUD             |

Recovery and invitation pages accept emailed tokens while signed out.
`/account/password` requires either a session or a reset token; the route loader
checks that boundary. `/auth/magic/[token]` requires a session and an explicit
confirmation POST. The hooks reject revoked sessions before redirecting.
Add a route under `src/routes/` and update this table in the same PR.

See [local-first notes](../../docs/architecture/local-first.md) for browser requirements and device data retention.

The shared environment banner identifies dev, staging and PR previews. It returns
after navigation or reload; set `PUBLIC_ENV_BANNER=false` to hide it. Production
has no label and shows no banner. See [deployment](../../docs/operations/deployment.md).

Signup does not claim agreement to policies. Add your application's policies and
acknowledgement flow before launch; see [auth](../../docs/architecture/auth.md#signup-policies).
Discord callback errors appear on login/register, and account-link results appear
on `/account/password`.

List pages report API failures instead of presenting an empty list. Malformed
JSON from the API is treated as an upstream failure.
