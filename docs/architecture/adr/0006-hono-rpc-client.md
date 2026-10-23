# ADR 0006 — Hono RPC client centralized in `@ak5/webui`

**Status:** Accepted

## Context

The frontends need to call the API. The API is a Hono app, and Hono ships an RPC
client (`hc<T>()`) that, given the API's exported route type, produces a fully
typed client — endpoints, params, and response shapes all checked at compile
time. Two questions follow: how do the frontends get those types without pulling
in the API's runtime, and where does the client get constructed so that
cross-cutting concerns (forwarding the auth cookie and client IP, sending
credentials) are not reimplemented in every app.

## Decision

Frontends consume the API through Hono RPC: `hc<WebApiType>()` /
`hc<AdminApiType>()`. The API exports **only types** to frontends — `WebApiType`
and `AdminApiType` are imported `type`-only, so no API runtime ever crosses into a
frontend bundle (the api package's runtime entry is a no-op type carrier).

The client is **not** instantiated per app. A single **`createApiClient`** factory
in **`@ak5/webui`** builds the typed client and owns the shared concerns in one
place: forwarding the inbound auth cookie and client IP, setting credentials, and
attaching request headers. Both `web` and `admin` call this one factory.

## Consequences

- **End-to-end type safety:** rename a route or change a response shape in the API
  and every frontend caller fails to compile until updated — no drift between
  client and server.
- **One place for cross-cutting wiring:** cookie/IP forwarding and credentials live
  in `createApiClient`, not copy-pasted into each app, so a fix or a new header
  applies everywhere at once.
- **No runtime coupling:** the type-only import keeps the API's server code out of
  frontend bundles; `audit:split` mechanically enforces that web/admin import
  `@ak5/api` type-only.
- Cost: the API must keep its route types exportable and stable enough to be a
  contract, and the type-carrier build step exists solely to ship `.d.ts` to
  consumers.

## Alternatives considered

- **Per-app `hc<>()` instantiation:** works, but duplicates the cookie/IP/
  credentials wiring in every frontend, so they drift. Centralizing in `@ak5/webui`
  is the same standardization rule the repo applies to any helper used in 2+ apps.
- **Hand-written fetch wrappers / OpenAPI-generated TS client:** loses the
  zero-config, always-in-sync types that come free from sharing the Hono route
  type directly.
