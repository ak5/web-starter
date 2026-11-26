#!/bin/bash
set -eu

args=(--ip "${DEV_HOST:-localhost}" --port "${AK5_API_PORT:-8350}" --env-file .env)
if [[ "${AK5_MCP_LOCAL:-}" == 1 ]]; then
  if [[ "${DEV_HOST:-}" != 127.0.0.1 ]]; then
    echo "Local MCP requires a loopback dev stack." >&2
    exit 1
  fi
  (cd ../.. && node scripts/configure-mcp.mjs packages/api/.env.mcp.wrangler.json)
  args+=(--config .env.mcp.wrangler.json --var COOKIE_ORIGIN:localhost
    --var "PUBLIC_APP_URL:http://127.0.0.1:$AK5_WEB_PORT"
    --var "PUBLIC_ADMIN_URL:http://127.0.0.1:$AK5_ADMIN_PORT")
fi
exec wrangler dev "${args[@]}"
