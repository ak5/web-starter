#!/usr/bin/env bash
# Sync GitHub-environment secrets into Cloudflare Worker secrets. The GitHub
# Environments (Prod Cloudflare / Staging Cloudflare) are the canonical source
# of truth; CI (.github/workflows/deploy-workers.yml) pushes them onto the Workers on
# every deploy. Values come from the caller's env, never from disk.
#
#   bash scripts/sync-cloudflare-worker-secrets.sh [--env staging]
#
# Run AFTER the deploy step: `wrangler secret put` targets an existing Worker,
# and the deploy is what creates it on the first run. Re-running is idempotent
# (secret put overwrites), so every deploy reconciles the Workers to the GitHub
# environment.
#
# Secret ownership (see CLAUDE.md): the api owns every data-touching secret;
# web/admin hold only JWT_SECRET (to verify sessions). JWT_SECRET MUST match
# across api/web/admin within an env — the same value is pushed to all three.
#
# Needs CLOUDFLARE_API_TOKEN in the env (wrangler auth) + account_id in each
# wrangler.jsonc. NOT synced as Worker secrets: the deploy CLOUDFLARE_API_TOKEN
# and NEON_API_KEY (deploy-/admin-only; don't leak the deploy token into runtime).
set -euo pipefail
cd "$(dirname "$0")/.."

wenv=()
if [[ "${1-}" == "--env" && "${2-}" == "staging" ]]; then
	wenv=(--env staging)
elif [[ $# -gt 0 ]]; then
	echo "usage: $0 [--env staging]" >&2
	exit 2
fi

put_secret() { # <pnpm-package> <SECRET_NAME> <required|optional>
	local pkg="$1" name="$2" req="$3" val="${!2-}"
	if [[ -z "$val" ]]; then
		if [[ "$req" == required ]]; then
			echo "Missing required GitHub environment secret: $name" >&2
			exit 1
		fi
		echo "Skipping optional Worker secret: $name (not set in this environment)"
		return
	fi
	printf '%s' "$val" | pnpm --filter "$pkg" exec wrangler secret put "$name" "${wenv[@]}"
}

echo "Syncing api Worker secrets"
put_secret "@ak5/api" DATABASE_URL required
put_secret "@ak5/api" JWT_SECRET required
put_secret "@ak5/api" TOKEN_ENCRYPTION_KEY required
put_secret "@ak5/api" DISCORD_CLIENT_SECRET optional

echo "Syncing web Worker secrets"
put_secret "@ak5/web" JWT_SECRET required

echo "Syncing admin Worker secrets"
put_secret "@ak5/admin" JWT_SECRET required
