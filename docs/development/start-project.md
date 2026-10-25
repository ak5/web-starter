# Create a project and choose mobile support

Create a branded project directly from the public starter with pnpm, Git and
Node 22 or newer:

```sh
pnpm dlx "github:ak5/web-starter#path:/packages/create" my-app --scope @myco --slug myapp
```

The creator uses the starter's main branch, initializes an independent Git
repository, applies branding, and defaults to **website only**. It refuses to
overwrite an existing destination. The generated project uses its own pinned
Node/pnpm versions through mise. Deployment credentials and local environment
files are not copied from another checkout.

Add `--mobile` to start with the mobile app enabled, `--no-oauth` to omit the
Discord login overlay, or `--install` to install dependencies through mise after
creation. Installation is otherwise an explicit next step:

```sh
cd my-app
mise install
pnpm install
pnpm dev:init
pnpm db:migrate
pnpm dev:auto
```

The generated app does not contain the creator package or its bootstrap tests.
The GitHub command needs no npm registry publication. A short registry command
such as `pnpm create @ak5/web-starter` requires publishing the creator package;
that command is not provided by this repository's GitHub URL alone.

## Disable or restore the mobile app

An existing fork can choose the same website-only profile:

```sh
pnpm mobile disable
pnpm mobile status
# Restore it whenever needed:
pnpm mobile enable
```

Disable removes `packages/mobile` from the repository, native-only dependency
patch registrations, native Dependabot entries, and Ruby/Java toolchain pins.
It reinstalls dependencies. API, web, admin, email, CLI and web notes remain
active; native checks and bundle jobs are skipped.

Before removal, the command moves local mobile files into an ignored
`tmp/mobile-backup-*/mobile` directory. This includes edits, `.env` files and
native caches. The backup stays on your machine and is not part of a commit.

Enable downloads `packages/mobile` from the exact starter commit recorded in
`.starter-mobile.json`, applies your application's branding, restores native
configuration, and reinstalls dependencies. It needs Git and network access.
It preserves intervening web configuration changes and refuses conflicting
native configuration. It restores the pinned starter source; merge any custom
mobile edits and local files from your ignored backup afterward.

`.starter-template.json` records the source revision and application branding;
the creator sets this to the exact commit it cloned. Keep the revision pinned
when adopting a newer mobile template, and review its compatibility with your
API and dependency versions. Both mobile commands accept `--no-install` when
another setup step will install dependencies. Commit source deletions or
restoration, profile metadata, configuration and lockfile together.

To select website-only mode during manual fork setup:

```sh
pnpm rebrand --scope @myco --slug myapp --no-mobile
```

## Mobile toolchains

With mobile enabled, root mise includes the pinned Ruby and Java versions.
Website-only mode excludes these tools. After enabling mobile, run `mise install`
and follow [mobile setup](../../packages/mobile/README.md).
