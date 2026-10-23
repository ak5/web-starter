# Conventions

The rules that keep the split monorepo coherent. `pnpm audit:split` and
`pnpm check:all` enforce most of these mechanically — this doc explains the
intent.

## File layout

SvelteKit route files stay **thin**. A `+page.server.ts`, `+layout.server.ts`, or
`+server.ts` module exists to wire the framework to the package library — it
parses the request, calls a lib function, and returns. The actual logic
(API calls, auth actions, form handling) lives in `@ak5/webui` lib helpers so
two apps can share it. `audit:split` flags route files that grow runtime logic.

Package responsibilities (full roster in [`../../CLAUDE.md`](../../CLAUDE.md)):

- **`@ak5/api`** — all runtime: Hono routes, DB, JWT issuance, OAuth callbacks.
- **`@ak5/web` / `@ak5/admin`** — SvelteKit surfaces; no library export.
- **`@ak5/shared`** — pure, cross-package utilities and contracts.
- **`@ak5/webui`** — shared Svelte 5 components and SvelteKit lib helpers.
- **`@ak5/email`** — transactional templates + sender.

## Where shared code goes

- **A UI element or frontend SvelteKit helper used in 2+ apps → `@ak5/webui`.**
  Never copy a component between web and admin; lift it to webui.
- **A pure, framework-free utility (cookie/jwt/pagination/public-id/types) →
  `@ak5/shared`.** Frontends don't import `shared` directly — webui re-exports
  the select shared types they need.

## Import boundaries

`audit:split` enforces these; a violation fails `check:all` and the pre-commit
hook:

- web/admin import `@ak5/api` **type-only** (the RPC contract types) — never its
  runtime.
- web/admin reach shared behavior via `@ak5/webui`, not direct `@ak5/shared`.
- the email + password auth core never imports the removable OAuth overlay.

## Public IDs

Never expose internal sequential/nanoid PKs. Every API response, URL, JWT, and
client-side value uses a prefixed `publicId` (`u-`, `a-`, `t-`, …). Internal PKs
exist only for joins. Generator: `packages/shared/src/public-id.ts`.

## Svelte 5 patterns

Use `$derived`, not `const`, for reactive props. `$derived` is writable — use it
for form inputs that sync with server data. Prefer the object syntax for
conditional classes:

```svelte
<div class={{
  'base-classes': true,
  'conditional-class': someCondition
}}>
```

## Pagination

`page` is **0-indexed everywhere**. The API computes `offset = page * limit`.
Frontend: `let page = $state(0)`. Display 1-indexed for humans (`page + 1`), but
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
