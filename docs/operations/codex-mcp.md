# Connect an MCP client

MCP is optional. The web and admin portals each serve `/mcp` and issue OAuth
credentials for their own URL. Use your regular account on the web portal or
your admin account on the admin portal.

```sh
codex mcp add starter-user --url https://www.example.com/mcp
codex mcp add starter-admin --url https://admin.example.com/mcp
```

Follow the browser sign-in and consent prompts. **Read only** lets users see
their items and admins see system health. **Read and operate** also lets users
create items and admins update their own display name. Access tokens last an
hour and refresh grants last 30 days. Use **Disconnect MCP clients** in the
portal's password settings to revoke its grants. KV changes can take time to
propagate.

## Hosted setup

Create a separate Workers KV namespace for each environment where MCP should
run. Set `MCP_OAUTH_KV_NAMESPACE_ID` in that GitHub deployment environment and
use the normal hosted development and production promotion workflows. Leave the
variable unset to disable MCP. PR previews leave MCP disabled. Keep query
redaction enabled and avoid logging OAuth headers and bodies.

## Local verification

Run `AK5_MCP_LOCAL=1 nice -n 10 pnpm dev:auto` to use an isolated local KV
binding. Use `http://127.0.0.1:<port>/mcp` with the web and admin ports from
`.env.dev-slot`. The OAuth provider accepts HTTP only on loopback. Use separate
browser profiles for the two roles on loopback because cookies share the host.
