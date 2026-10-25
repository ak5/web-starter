# @ak5/webui

Shared Svelte 5 components used by both `@ak5/web` and `@ak5/admin`. Built
via `@sveltejs/package` to `dist/`.

**Rule:** any UI element used in 2+ frontend apps lives here. Single-app
components stay in that app's `src/components/`.

## Components

Imported as `import Foo from '@ak5/webui/components/Foo.svelte'`.

| Component             | Notes                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `ActionButton`        | Primary action with optional confirmation modal                      |
| `ChannelCard`         | Connected OAuth channel display                                      |
| `ConnectChannelModal` | OAuth connect prompt                                                 |
| `CurrencyInput`       | Currency input with normalization                                    |
| `EnvironmentBanner`   | Optional environment label; dismissal resets on navigation or reload |
| `Footer`              | Shared footer with legal links                                       |
| `GDPRCookies`         | Cookie consent banner                                                |
| `GoogleTag`           | GA / GTM embed                                                       |
| `IconSocial`          | Social-platform icon renderer                                        |
| `ImageUpload`         | Webp-only upload with size validation                                |
| `Modal`               | Generic modal wrapper                                                |
| `Pagination`          | 0-indexed paginator                                                  |
| `SelectSingle`        | Single-select dropdown                                               |
| `ThemeToggle`         | Dark / light toggle                                                  |
| `UserCard`            | User profile card                                                    |

## Library exports

Imported as `import { X } from '@ak5/webui'`:

- `createSvelteKitHandle(config)` — auth gate factory used by both web
  and admin's `hooks.server.ts`. Config:
  - `allowedJwtType` — 'user' | 'admin'
  - `verifyJwt(raw)` — function returning a `JwtPayload` or null
  - `cookieName` — defaults to `ak5_token`
  - `isProtectedPath(path)` — required
  - `isAuthPage(path)` — for redirect-when-already-logged-in
  - `requiresEmailConfirmed(path)` — gate
  - `loggedInHome(payload)` — where to redirect logged-in users on auth pages
  - `attachLocals(event, payload)` — populate `event.locals`

## Build

```bash
pnpm --filter @ak5/webui build    # one-shot
pnpm --filter @ak5/webui dev      # svelte-package --watch
```

Auto-rebuilds in `pnpm dev` so consumers hot-reload from the new dist/.
