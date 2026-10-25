# Local-first notes with LiveStore

The web `/notes` route and native **Offline notes** screen share `@ak5/sync`:
a LiveStore schema, deterministic event materializers, and the HTTP sync client.
Each device writes to local SQLite immediately. LiveStore sends pending events
when connectivity returns and pulls events from other devices. The browser uses
OPFS in a dedicated worker; native uses Expo SQLite on the Symbiote / React Native
host. No React UI wrapper is required.

Identity, admin records, and the online **items** example use the Hono API and
Drizzle D1 tables. Notes have a separate event log in the same D1 database. Do not
write note state through Drizzle or add a second REST write path for these records.

## Storage and ordering

`notes-v1-<user public ID>` identifies one private store per user. Note IDs are
random UUIDs. Store IDs accept the starter's lowercase, fixed-length public IDs
only, avoiding collisions when the D1 provider converts store IDs to table names.
`v1.NoteSet` replaces a whole note; `v1.NoteDeleted` removes it.
Concurrent edits resolve in LiveStore's accepted event order; there is no text
merge or collaborative editor. Materializers replay that order identically on
every client. Keep published event names and materializers stable; follow
[LiveStore's schema guidance](https://docs.livestore.dev/) for application changes.

The pending indicator includes writes awaiting local persistence and events
awaiting server acknowledgement. The shared status subscription reads the pinned
LiveStore version's leader sync state; recheck it when upgrading LiveStore.

The API exports `NotesSync`, using the official Cloudflare sync provider with
`storage: { _tag: 'd1', binding: 'DB' }`. D1 stores the event log in LiveStore-managed
`eventlog_*` tables. A SQLite Durable Object per store coordinates ordering; this
is not a Drizzle notes table or a D1 read replica. LiveStore creates its event-log
tables on first use. Existing Drizzle migrations still provision identity and
online items.

Development, optional stable staging and production bind separate databases and
Durable Object namespaces. PR previews share development's D1 **and development's
`NotesSync` Durable Object binding**.
Multiple independent Durable Objects must not coordinate the same D1 store.
Deploy development before enabling previews. Preview writes affect development
accounts and data; use disposable development accounts.

## Authentication

The provider resolves the store ID to one logical Durable Object per user in
each environment, created on demand and shared by that user's devices. The
client polls over HTTP every three seconds. WebSockets are disabled, so this
setup does not use WebSocket hibernation.

Only POST HTTP sync is enabled. Each request verifies the existing JWT session
cookie, the active user in D1, and the exact store ID. The Durable Object checks
again on push and pull. Admin sessions, banned/deleted users, expired sessions,
unknown events, and invalid note arguments are rejected. Unconfirmed user sessions
can use notes, just as they can access the authenticated web shell. Add product
quotas/rate limits before opening this demo to high-volume workloads.

The browser sends same-origin `/sync` requests through a thin SvelteKit proxy to
the API service binding. HttpOnly cookies remain HttpOnly. Native supplies the
securely stored session as a `Cookie` header. Credentials never belong in the
sync URL or `syncPayload`; the API rejects client payload claims. There is no
separate LiveStore API key. Notes are private per account, not end-to-end encrypted.
The account and Cloudflare operators can access server data.

## Offline behavior and device data

Once opened, web notes can be edited offline. OPFS requires a secure context
(HTTPS or localhost), compatible workers, SharedArrayBuffer, and cross-origin
isolation. The notes screen rejects an in-memory fallback so it cannot silently
lose edits on restart. The web app sets COOP `same-origin`, COEP `credentialless`, and permits
WebAssembly in CSP. Check third-party assets and popup integrations when changing
those headers. This starter has no offline page cache: loading the web shell from
scratch still requires a connection. Browser storage eviction can remove local,
unsynced changes.

Sync retries initial server contact after network failures and timeouts, so a
store reopened offline can send its queue when connectivity returns.

Native caches the last authenticated viewer alongside its session in secure
storage. A network failure during restore permits reopening that user's local
notes; an explicit server rejection clears the session. Cached identity never
authorizes server sync. Sign in again when the session expires to resume syncing.

Signing out closes the local store and clears the visible notes and session.
It retains the account-scoped local database so pending edits can resume after
signing into the same account. Shared devices retain this data on disk; use OS
protection. Clearing app/browser storage or uninstalling can lose unsynced edits.
Account deletion disables sync; provision an explicit retention/deletion procedure
for LiveStore event logs in your product's data lifecycle. Do not assume the
identity row's soft deletion deletes event history.

## Run and verify

Run `pnpm install`, `pnpm dev:init`, `pnpm db:migrate`, and `pnpm dev:auto`.
Sign in on web, open **Offline notes**, and add a note with the network disabled.
Reconnect and open the same account on a second device to confirm delivery.
Native setup additionally requires `pnpm app:pods` on iOS and a rebuilt host after
adding the Expo SQLite, Application, Crypto, Asset, Constants, and Expo Fetch modules. The LiveStore Expo adapter
is pinned; its older declared Expo peers are explicitly allowed for this host.
Babel transforms namespace exports and dynamic imports for Metro; the native
entry installs secure randomness before LiveStore loads. React Native 0.88's
Hermes runtime provides the UTF-8 codecs. Expo autolinking supplies the native
module graph, including annotation-based Application and SQLite registrations.
The pinned adapter patch in `patches/` implements LiveStore's database-to-database
import contract with SQLite's native backup API, including fresh state initialization
and rebuilds. Temporary deserialized snapshot connections close on failure.
Recheck native builds, fresh initialization, persistence, and sync when upgrading
LiveStore or Expo.

`pnpm test:db` checks store authorization and event validation against disposable
D1. `pnpm test --project=web --workers=1` covers browser SQLite persistence,
offline commits retained across reload before syncing, reconnection, cross-device
edits/deletion, and account isolation.
These use the local mock email transport, not live recipients.
