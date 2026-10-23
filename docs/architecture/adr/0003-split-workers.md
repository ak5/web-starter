# ADR 0003 — Split workers per surface

**Status:** Accepted

## Context

The app has distinct surfaces: a JSON API and one SvelteKit frontend per persona
(at minimum a public `web` app and an `admin` portal). All of them deploy to
Cloudflare Workers. The simplest packaging would be a single worker that serves
both the API and the rendered frontends from one bundle. But the surfaces have
very different secret needs and very different deploy cadences, and a monolith
would force them to share both.

## Decision

Deploy **one worker per surface**: a single `@ak5/api` worker plus one SvelteKit
worker per persona (`@ak5/web`, `@ak5/admin`, …), each with its own
`wrangler.jsonc`, custom domain, and deploy. The API is the only worker that
holds data-touching secrets (provider secrets, encryption keys);
the frontend workers hold **only** `JWT_SECRET`, and only to verify cookies —
never to write data. Frontends consume the API across a clean type boundary
(type-only RPC; see ADR 0006), not by importing its runtime.

## Consequences

- **Independent deploys:** shipping a frontend change does not redeploy the API,
  and vice versa. Blast radius per deploy is one surface.
- **Least-privilege secrets:** a compromise of a frontend worker yields a
  verify-only key, not the database. The "API owns the DB" rule from ADR 0001 is
  what makes this enforceable.
- **Clean type boundary:** the API exports `WebApiType` / `AdminApiType`, and
  each frontend imports only the types for its own surface, so `admin`-only
  endpoints are a compile error from the public app.
- This generalizes to **N personas**: adding a surface is copying a frontend
  worker, exporting a new `<Persona>ApiType`, and claiming a dev slot + Caddy
  upstream — no change to the API's packaging.
- Cost: more workers to configure and deploy, and shared cross-cutting code must
  live in a real package (`@ak5/webui`, `@ak5/shared`) rather than being colocated.

## Alternatives considered

- **Single monolith worker:** one deploy, one config, but every surface shares
  every secret and every redeploy ships everything. The secret-blast-radius cost
  was the dealbreaker.
- **API split per persona too:** maximal isolation, but the API is genuinely
  shared logic; splitting it would duplicate auth/DB code with no benefit.
