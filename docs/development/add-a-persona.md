# Add a frontend persona

The split generalizes to **N SvelteKit apps over one API worker**. `@ak5/web` and
`@ak5/admin` are the two that ship; this is the recipe to add a third (or fourth).
The **API worker is invariant** — you do _not_ add a second API. A persona is a new
frontend surface plus a new scoped sub-router on the existing api.

Throughout, `<persona>` is the lowercase package slug (e.g. `partner`) and
`<Persona>` is the PascalCase type prefix (e.g. `Partner`).

## 1. Copy the web package

```sh
cp -r packages/web packages/<persona>
```

Retoken the new package's `package.json` name to `@ak5/<persona>` and update its
`wrangler.jsonc` worker name. Clear the example routes you don't need.

## 2. Add the persona's pre-login routes + export its API type

In `packages/api/src/app.ts`:

- Add the persona's **pre-login** routes (its own `/auth/<persona>/login` etc.),
  alongside the existing `WebApiType` / `AdminApiType` scoped sub-routers.
- Export a `<Persona>ApiType` that exposes the persona's pre-login set **plus** the
  shared post-login set. This is the scoped-router pattern — each persona sees only
  its own pre-login endpoints; calling another persona's pre-login route is a
  compile error.

## 3. Widen the JWT type union

The JWT carries a `type` discriminator. Add the persona's value to the `JwtType`
union (`packages/shared/src/jwt.ts`) and to `requireAuth(type?)` so the post-login
guard recognizes it. Decide the persona's cookie name if it needs its own.

## 4. Claim a dev slot + Caddy upstream

Each surface binds a direct upstream port `base + (slot-1)*10`. Pick the next free
base port for the new surface and add it to the slot scheme, then add a Caddy
upstream + Host route (e.g. `<persona>.ak5.localhost`) in the dev-host generation.
The new surface joins the others under the per-slot Caddy port (`:8359` on slot 1).

## 5. Add a root `dev:<persona>` script

In the root `package.json`, add `"dev:<persona>": "pnpm --filter @ak5/<persona>
dev"` and include the new surface in the `dev-stack` launch so `pnpm dev` brings
it up with the rest.

## 6. Update the roster + docs

- Add the persona to the **Packages** roster in [`../../CLAUDE.md`](../../CLAUDE.md).
- Add a docs↔code sync row (e.g. _"`<persona>` route added/changed →
  `packages/<persona>/README.md` routes table"_) to the table in `CLAUDE.md`, and
  add the package's README to [`../index.md`](../index.md) if it has docs.

## 7. Verify the wiring

```sh
pnpm audit:split
pnpm check:all
```

`audit:split` confirms the new persona obeys the package boundaries (type-only
`@ak5/api`, shared via `@ak5/webui`, thin routes). A clean `check:all` confirms the
`<Persona>ApiType` export and JWT union compile end to end.

For the native mobile client, use [mobile setup](../../packages/mobile/README.md).
It consumes the same typed user API and renders Svelte through Symbiote / React
Native; it does not need a SvelteKit Worker or the browser UI package.
