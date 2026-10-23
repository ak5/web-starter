# @ak5/admin

SvelteKit on Cloudflare Workers — the admin portal. A pure UI worker that talks
to `@ak5/api` through the **admin-scoped** typed client (`hc<AdminApiType>`);
calling a web-only route from here is a compile error. Everything except
`/login` requires an admin JWT.

## Routes

| Route     | Auth  | Purpose                            |
| --------- | ----- | ---------------------------------- |
| `/`       | admin | Admin home — user list (protected) |
| `/login`  | guest | Admin sign in                      |
| `/logout` | admin | Clear the session (POST) → `/`     |

Auth gating lives in `src/hooks.server.ts` (`isProtectedPath` = everything but
`/login`). Add a route under `src/routes/` and update this table in the same PR.
