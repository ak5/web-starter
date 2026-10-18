# @ak5/web

SvelteKit on Cloudflare Workers — the public app surface. A pure UI worker: it
owns no DB, verifies the JWT cookie locally, and talks to `@ak5/api` through the
typed Hono client in `#lib/api` (`hc<WebApiType>`). Auth flows are wired through
`@ak5/webui`'s action helpers.

This ships a **minimal example surface** — replace it with your product, keep the
auth wiring.

## Routes

| Route             | Auth   | Purpose                              |
| ----------------- | ------ | ------------------------------------ |
| `/`               | public | Starter overview and author credit   |
| `/login`          | guest  | Sign in (email + password)           |
| `/register`       | guest  | Create an account                    |
| `/account/verify` | user   | Enter verification code or resend    |
| `/dashboard`      | user   | Authed example dashboard (protected) |
| `/logout`         | user   | Clear the session (POST) → `/`       |

Protected prefixes and auth-page redirects live in `src/hooks.server.ts`. Add a
route under `src/routes/` and update this table in the same PR.
