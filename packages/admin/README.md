# @ak5/admin

React Router on Cloudflare Workers — the admin portal. A pure UI worker that talks
to `@ak5/api` through the **admin-scoped** typed client (`hc<AdminApiType>`);
calling a web-only route from here is a compile error. Account recovery pages are public; operational pages require a current admin session. The shared middleware verifies the JWT and
checks its generation with the API before accepting or refreshing it.

## Routes

| Route                 | Auth                   | Purpose                                        |
| --------------------- | ---------------------- | ---------------------------------------------- |
| `/`                   | admin                  | Search, filter, and manage users and admins    |
| `/login`              | guest                  | Admin sign in                                  |
| `/logout`             | admin                  | Clear the session (POST) → `/`                 |
| `/forgot-password`    | public                 | Request a reset link by email                  |
| `/account/password`   | session or reset token | Set, reset or change password                  |
| `/invite`             | public                 | Open the invitation password form              |
| `/auth/magic/[token]` | session                | Confirm a reauthentication link                |
| `/audit-log`          | admin                  | Filter and page through recorded admin actions |
| `/items`              | session                | Paginated read-only item list                  |

Recovery and invitation pages accept emailed tokens while signed out.
`/account/password` requires either a session or a reset token; the route loader
checks that boundary. `/auth/magic/[token]` requires a session and an explicit
confirmation POST. The server middleware rejects revoked sessions before redirecting.
Add the route in `src/routes.ts` and update this table in the same PR.

The shared environment banner identifies dev, staging and PR previews. It returns
after navigation or reload; set `PUBLIC_ENV_BANNER=false` to hide it. Production
has no label and shows no banner. See [deployment](../../docs/operations/deployment.md).

List pages report API failures instead of presenting an empty list. Malformed
JSON from the API is treated as an upstream failure.

On **Users**, enter the recipient's email and username and select
**User** or **Admin**. Admin invitations are email-only. **Send email invite**
delivers the invitation and verifies the recipient's address when they redeem it.
For regular users, **Create and copy invite link** gives you a private URL to share and leaves the
address unverified. If the browser blocks clipboard access, use **Copy invite
link** or select the displayed URL manually. Both links expire after seven days
and can be used once to set a password.

Use **Pending invitations** to find users who still need to set a password.
A replacement invalidates the previous invitation link.

Use **Ban** or **Unban** on a regular user's row. A ban blocks sign-in and
authenticated access while it is in effect. Both actions appear in **Audit Log**.
