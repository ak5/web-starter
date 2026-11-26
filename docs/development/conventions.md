# Conventions

The rules that keep the split monorepo coherent. `pnpm audit:split` and
`pnpm check:all` enforce most of these mechanically — this doc explains the
intent.

## File layout

Keep route modules thin. Declare routes in `src/routes.ts`. A route's loader
or action reads the request and delegates to package helpers. Put Worker-only
code in `*.server.ts` modules and share it through `@ak5/webui/server`.
Package responsibilities (full roster in [`../../CLAUDE.md`](../../CLAUDE.md)):

- **`@ak5/api`** — all runtime: Hono routes, DB, JWT issuance, OAuth callbacks.
- **`@ak5/web` / `@ak5/admin`** — React Router surfaces; no library export.
- **`@ak5/mobile`** — React Native screens and Expo platform integration.
- **`@ak5/shared`** — pure, cross-package utilities and contracts.
- **`@ak5/sync`** — shared notes schema, events, and HTTP sync client.
- **`@ak5/webui`** — React browser components and Worker helpers.
- **`@ak5/email`** — React transactional templates and sender.

## Where shared code goes

- Put components and server helpers shared by web and admin in `@ak5/webui`.
- Put framework-free contracts and utilities such as cookie names, JWT claims,
  pagination, and public IDs in `@ak5/shared`. Web and admin reach them through
  `@ak5/webui`. Native imports only the platform-safe entry points it needs.
- Use React Native primitives for mobile screens. Keep browser rendering,
  native rendering, and platform storage in their respective packages.

## Import boundaries

`audit:split` enforces these; a violation fails `check:all` and the pre-commit
hook:

- Web, admin, and mobile import `@ak5/api` **type-only** (the RPC contract types).
- web/admin reach shared behavior via `@ak5/webui`, not direct `@ak5/shared`.
- the email + password auth core never imports the removable OAuth overlay.

## Public IDs

Never expose internal sequential/nanoid PKs. Every API response, URL, JWT, and
client-side value uses a prefixed `publicId` (`u-`, `a-`, `t-`, …). Internal PKs
exist only for joins. Generator: `packages/shared/src/public-id.ts`.

## Pagination

`page` is **0-indexed everywhere**. The API computes `offset = page * limit`.
Display 1-indexed for humans (`page + 1`), but
send `String(page)` straight to the API — no arithmetic at the boundary.

## Error handling

API mutations validate input with a zod backstop (`zValidator('json', …)`) and
return structured error bodies. On the frontend, surface API errors through the
webui helpers (`apiErrorBody` / `apiErrorMessage`) rather than rendering raw
responses.

## No tombstones

No tombstone comments (`// removed X`, `// was previously Y`), no `_unused`
annotations, no references to deleted code. Comments describe what the current
code does or why — never what used to be there. If code is removed, its comments
and its docs go with it.

## Commit style

Small, focused commits with imperative subject lines ("Add magic-link reauth",
not "added" / "adding"). One logical change per commit. If a change touches the
left column of the docs↔code table in [`../../CLAUDE.md`](../../CLAUDE.md), update
the right column in the **same** commit/PR.
