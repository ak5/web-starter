# OAuth login providers

OAuth login is a **removable overlay** on top of the email + password core.
**Discord is the one bundled provider**; others (Google, GitHub, …) follow the
same recipe below. The core never imports from the overlay, so the whole thing
can be deleted (`pnpm rebrand --no-oauth`, or by hand) without breaking auth.
This doc is the recipe for adding a provider.

## The pieces

A login provider needs four things:

1. **A kickoff + callback route** in `@ak5/api`, mounted under `/oauth` —
   `GET /oauth/<provider>` redirects to the provider, and
   `GET /oauth/<provider>/callback` exchanges the authorization code for the
   provider's profile, resolves or creates the local identity, issues the
   standard `ak5_token` JWT (the same token the password path issues), and
   redirects back to the app. The bundled Discord overlay is `/oauth/discord`
   and `/oauth/discord/callback` (`routes/oauth/`, `lib/oauth/discord.ts`).
2. **A provider identity table** (`auth_<provider>`, shaped like `auth_email`),
   discriminated by `subject_type` + `subject_id` so the same credential row
   attaches to either `users` or `admin_users`. Refresh tokens, if any, are
   stored encrypted at rest.
3. **Env client id + secret** owned by `@ak5/api` only
   (`<PROVIDER>_CLIENT_ID` / `<PROVIDER>_CLIENT_SECRET`) — never handed to the
   frontends, which only verify the resulting JWT.
4. **A `/auth/options` entry** so the frontend knows the provider is enabled and
   can render its button.

## The overlay boundary

The overlay lives in its own module (`auth-oauth`) and the password core must not
import it. `pnpm audit:split` enforces this: a core auth file importing the
overlay fails the build. The benefit is that a fork can delete `auth-oauth`,
drop the `auth_<provider>` tables, and ship a pure email + password app with no
dangling references.

## Adding a provider — checklist

- [ ] Add `auth_<provider>` to the schema (one additive migration).
- [ ] Add the start + callback routes inside the overlay module.
- [ ] Add `<PROVIDER>_CLIENT_ID` / `_SECRET` to the api `.env.example` and
      `wrangler.jsonc` secrets.
- [ ] Surface the provider in `/auth/options`.
- [ ] Update this doc and `docs/operations/3rd-party-services.md`.

> This overlay is for **login only** — using a provider to sign in. OAuth used to
> connect a third-party account and pull its data is application-specific and is
> not part of this starter.
