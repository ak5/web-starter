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
Discord login overlay. Review and trust the generated mise configuration, then
install its tools and dependencies:

```sh
cd my-app
mise trust # review and trust the generated configuration
mise install
pnpm install
pnpm dev:init
pnpm db:migrate
pnpm dev:auto
```

The generated app does not contain the creator package or its bootstrap tests.
Rebranding preserves dependency integrity hashes, upstream attribution and local
`.env` / `mise.local.toml` files. It changes application branding, not credentials
or package checksums.
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

## Clone with shared starter history

The creator starts independent Git history. To merge future starter updates
with shared ancestry, use this alternative instead. A manual clone includes mobile
source; add `--no-mobile` when rebranding if you only need the website.

Create an empty repository for your application. Clone this starter as a normal repository, then keep it as `upstream`
so you can bring in future fixes. A GitHub fork is not required.

```sh
git clone https://github.com/ak5/web-starter.git myapp
cd myapp
git remote rename origin upstream
git remote add origin git@github.com:YOUR_ORG/YOUR_REPO.git
mise trust             # review and trust this checkout
mise install
pnpm install
pnpm rebrand --scope @myco --slug myapp
pnpm dev:init
```

`rebrand` replaces the starter's brand tokens. Add `--no-oauth` to omit the
Discord login overlay, or skip rebranding to keep the defaults. It deletes its
own initializer after running.

Apply the schema to local D1 and launch. Local database development needs no
Cloudflare account or database credentials:

```sh
pnpm db:migrate
pnpm dev:auto
```

Read `.env.dev-slot` for your selected local URLs. The API, web, admin, and email
preview run behind Caddy; the email mock keeps development mail local.
See [local setup](setup.md) for prerequisites and configuration.

Commit your application changes and push to your new origin:

```sh
git add .
git commit -m "Initialize my application"
git push -u origin main
```

### Bring in starter updates

Keep starter updates separate from your product work and review them on a branch:

```sh
git fetch upstream
git switch -c chore/starter-update
git merge upstream/main
# Resolve conflicts and review changes before running the checks.
nice -n 10 pnpm check:all
nice -n 10 pnpm test:unit
nice -n 10 pnpm test:db
git push -u origin chore/starter-update
```

Open a PR in your own repository. Updates are ordinary Git merges; changes to
branded files, removed packages, or your product features can require manual
conflict resolution. Keep the shared history so future merges can identify what
has already been applied.

## Mobile toolchains

With mobile enabled, root mise includes the pinned Ruby and Java versions.
Website-only mode excludes these tools. After enabling mobile, run `mise install`
and follow [mobile setup](../../packages/mobile/README.md).

## Recover from setup failures

If rebranding completes but dependency installation or formatting fails, the
command exits unsuccessfully and keeps the branded source. Fix the error shown,
then run `pnpm install` and `pnpm format` from the project root. The one-time
initializer has already removed itself; do not rebrand the project again.
