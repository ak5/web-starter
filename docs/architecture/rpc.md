# RPC: the typed Hono contract

Frontends never hand-write fetch calls against the API. They consume a **typed
Hono RPC client** generated from the API's own route definitions, so the request
shape, params, and response type are checked at compile time.

## API exports types, not runtime

`@ak5/api` exports two types from `src/app.ts`:

- `WebApiType` — the routes the public app may call.
- `AdminApiType` — the routes the admin portal may call.

The package's runtime entry is a **no-op type carrier**: there is no runtime edge
from a frontend into the API worker. Frontends import `@ak5/api` **type-only**,
and `pnpm audit:split` fails the build if a value import sneaks in.

## One client factory in `@ak5/webui`

Rather than each app calling `hc<…>()` directly, the Hono client is built in one
place — `createApiClient` in `@ak5/webui`:

```ts
// @ak5/web
import { createApiClient } from '@ak5/webui';
import type { WebApiType } from '@ak5/api';

const api = createApiClient<WebApiType>(API_BASE_URL, event.fetch, event.request);
const res = await api.auth.me.$get(); // typed route, typed response
```

`createApiClient` centralizes three concerns so no app re-derives them:

- **`credentials: 'include'`** — the auth cookie rides along on every call.
- **Cookie forwarding** — in SvelteKit server load/actions the incoming
  request's cookies are forwarded to the API, and `Set-Cookie` from the API is
  forwarded back to the browser (via `forwardSetCookie`), so login/refresh "just
  work" through the server hop.
- **Client-IP forwarding** — the original client IP (`x-forwarded-for`) is
  passed through, so the API's per-IP rate limiting sees the real caller, not the
  SvelteKit worker.

## Adding a route is instantly typed

Because the client type is `hc<WebApiType>()` and `WebApiType` is inferred from
`app.ts`, a new route is **immediately visible and typed** in the frontend with
no codegen step:

1. Add the route to its router in `@ak5/api` (path, validator, handler).
2. Mount it under the web or admin scope in `app.ts`.
3. `api.<new>.<route>.$post(...)` is now type-checked in the frontend — wrong
   params or response access fail `pnpm check:all`.

The contract is the source. There is no OpenAPI/JSON intermediary; the type flows
straight from Hono. The native mobile app uses the same `WebApiType` with Hono's `hc` client.
It stores the session cookie value in the device secure store and sends it on
authenticated requests. API types are imported only from the package root.
