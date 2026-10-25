# Local setup

How to get the full stack running on your machine. Tokens below (`@ak5/*`,
`.ak5.localhost`) are the starter defaults — `pnpm rebrand` may have replaced them.

## Prerequisites

The repo pins its own toolchain with [mise](https://mise.jdx.dev). Install mise,
then let it install everything else:

```sh
mise trust             # review and trust this checkout
mise install
```

The workspace uses Node 26 and pnpm 12. Root mise installs the web toolchain,
Caddy and Lefthook, plus Ruby 4 and JDK 25 when mobile is enabled. Website-only
mode excludes the native tools. Mise also auto-loads `.env.dev-slot` (your active
dev slot's ports + URLs) and sets a per-worktree `XDG_CONFIG_HOME` so each
checkout keeps its own CLI persona store.

The `tsc` command uses TypeScript 7's native compiler. Svelte, ESLint and native
editor plugins use Microsoft's `@typescript/typescript6` API package, installed
under the `typescript` alias. This is the
[supported side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0)
for tools that require the JavaScript compiler API.

`pnpm clean` removes installed workspace dependencies; reinstall with
`pnpm install --frozen-lockfile`. Use `pnpm clean:build` to clear generated builds
and check caches while keeping dependencies installed.

The database is local D1 through Wrangler. You do not need a Cloudflare account,
a connection string, or an external database server for local development.

## Start from the starter

Clone a normal repository, keep the starter as `upstream`, and add your own
empty repository as `origin`. This preserves shared history for future updates
without creating a GitHub fork. Follow the [README install and update instructions](../../README.md#create-your-project).

## First run

```sh
pnpm install            # workspace deps
pnpm -w run dev:init    # one-time setup (see below)
pnpm db:migrate         # initialize the local D1 schema
pnpm dev:auto           # launch on the next free slot
```

`dev:init` does the one-time setup so a fresh clone is ready to run:

1. **`build:libs`** — generates Worker bindings/runtime types, then builds libraries in dependency order
   (`shared → email → webui → api`). There is no `prepare` hook; every build is
   explicit.
2. **Scaffold `.env`** — copies each package's `.env.example` to `.env` (these
   are gitignored).
3. **Rotate `JWT_SECRET`** — generates one shared secret and writes the _same_
   value into the api, web, and admin `.env` files. They must match.
4. **`lefthook install`** — wires up the pre-commit hook.

## The dev slot model

`pnpm dev` runs on **slot 1**. [Caddy](https://caddyserver.com) fronts every
surface on a single port per slot. Slot 1 lands on `:8359`; slot N on
`:835(N-1)9`. Open these in the browser:

| Surface       | URL (slot 1)                 |
| ------------- | ---------------------------- |
| Web           | `web.ak5.localhost:8359`     |
| API           | `api.ak5.localhost:8359`     |
| Admin         | `admin.ak5.localhost:8359`   |
| Email preview | `preview.ak5.localhost:8359` |
| Email mock    | `mock.ak5.localhost:8359`    |

`*.ak5.localhost` resolves to loopback automatically on most systems; if not, add
the hosts to `/etc/hosts`. Caddy binds `127.0.0.1` only — it is the only
public-facing process.

## Multiple worktrees / slots

Each git worktree gets its **own slot** and its **own `XDG_CONFIG_HOME`** (the
`.ak5-config` dir), so two checkouts never collide on ports or CLI identity. To
auto-pick the next free slot:

```sh
pnpm dev:auto           # finds the next free slot and launches it
```

Slot N's URLs shift the namespace (`ak5` → `ak5<N>`) and the port (`+10` per
slot): slot 2 is `web.ak52.localhost:8369`, and so on.

## Bypassing Caddy

Each surface also binds a direct upstream port on `127.0.0.1`, computed as
`base + (slot-1)*10`. Base ports: api `8350`, web `8351`, admin `8352`, preview
`8354`, mock `8355`. Hit these to bypass Caddy's Host routing entirely (handy
when debugging the proxy).

## Creating an admin

The admin tables start empty. Seed one:

```sh
pnpm create:admin
```

## Environment notes

- `.env` is per package; `.env.example` is the checked-in template.
- **`JWT_SECRET` must be identical across api / web / admin.** `dev:init` does this
  for you; if you ever desync them, run `pnpm -w run rotate-jwt-secret` to
  regenerate and rewrite all three.
- The api owns every data-touching secret (provider keys); web and
  admin hold only `JWT_SECRET`, used to verify cookies.
- `COOKIE_ORIGIN` (api) / `PUBLIC_COOKIE_ORIGIN` (apps) control the cookie
  `Domain`/`Secure` attributes. `pnpm dev` writes `.ak5.localhost` (Domain set,
  Secure off — dev is plain HTTP).

Before deploying transactional email, complete the consuming app's own
[Cloudflare Email Sending setup](../operations/email-sending.md). Workers Paid billing,
manual enablement, verified sender DNS, and Email Sending:Edit on the deployment
token are prerequisites. Local setup uses the mock and does not send real mail.

For iOS/Android development, see [native mobile setup](../../packages/mobile/README.md).

## Inspect local D1

Use Wrangler's local explorer URL printed by `pnpm dev:api`, or query with
`pnpm wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type = 'table'"`.

For one-command creation and reversible website-only mode, see
[project profiles](start-project.md).
