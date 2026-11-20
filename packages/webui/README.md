# @ak5/webui

Shared React components and server helpers for `@ak5/web` and `@ak5/admin`.
Keep a component here when both apps use it. Keep single-app components in
the app that renders them.

- Import React components from `@ak5/webui/components/<Component>`.
- Import browser-safe utilities from `@ak5/webui`.
- Import auth middleware, auth actions, and the typed Hono client factory
  from `@ak5/webui/server` in Worker and route server code.

`createAuthMiddleware` accepts the app's JWT role, public and protected route
rules, and home path. The request context supplies Worker environment variables
and the upstream fetch function. The middleware checks the active session with
the API before accepting or refreshing its cookie.

Each app's Tailwind stylesheet includes `@source '../../webui/src';` to
generate the components' utilities. Components use DaisyUI and React Router
forms and links.

`pnpm --filter @ak5/webui build` emits JavaScript and declarations into
`dist/`. The local stack watches this build for edits.
