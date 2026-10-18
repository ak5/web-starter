# ADR 0002 — Stateless JWT over server-side sessions

**Status:** Accepted

## Context

Every surface — the API and the SvelteKit frontends — runs on Cloudflare
Workers, which are stateless and edge-distributed. There is no sticky process to
hold an in-memory session and no local session store. A classic server-side
session would mean a database (or KV) lookup on every authenticated request,
including from the frontend workers, which would each have to call the API just
to learn who the user is before rendering a page.

## Decision

Use **stateless JWTs**. On login the API issues an HS256-signed token carrying
the user's public ID (`sub`), `type`, and auth timestamps, set as an httpOnly
cookie `ak5_token` (admin stash `ak5_admin_token`) with a 7-day max-age,
`SameSite=Lax`, and `Secure` in prod. Because the signing key (`JWT_SECRET`) is
shared across all three workers, each frontend worker **verifies the cookie
locally** in its SvelteKit `handle` and knows the caller's identity without an
API round-trip.

## Consequences

- Frontends resolve the current user from the cookie alone — no per-request API
  call for identity, which suits the edge model.
- The cost is **revocation**. A stateless token is valid until it expires.
  - Global revocation is **`JWT_SECRET` rotation**: rotating it invalidates every
    outstanding token at once (a global logout).
  - Per-user revocation is a **DB ban/delete check in `requireAuth`**: the
    middleware treats `deleted_at` / `banned_at` in the database as the source of
    truth, so a banned user is rejected on their next API call even though the
    JWT still verifies. Frontends trust the cookie for rendering; the API is the
    enforcement point for state-changing calls.
- `JWT_SECRET` must match byte-for-byte across api/web/admin, which the env
  tooling enforces.
- Sensitive actions additionally require a recent auth timestamp inside the JWT
  (a 15-minute window), so a long-lived token alone cannot perform them.

## Alternatives considered

- **Server-side sessions (DB/KV-backed):** instant revocation, but a store lookup
  on every request from every worker, and a session store to operate. The edge
  topology makes the round-trips especially costly.
- **Opaque tokens with an introspection endpoint:** revocable, but reintroduces
  the per-request API call the JWT design exists to avoid.
