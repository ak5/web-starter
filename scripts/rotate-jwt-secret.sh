#!/usr/bin/env bash
# Rotate JWT_SECRET across all workers that share it. The value must match
# @ak5/api, @ak5/web, and @ak5/admin or JWT verification breaks on the
# mismatched worker.
#
# Usage:
#   scripts/rotate-jwt-secret.sh                     # dev: generate + write local .env files
#   scripts/rotate-jwt-secret.sh <secret>            # dev: write a supplied secret locally
#   scripts/rotate-jwt-secret.sh --prod    [<secret>]  # prod workers: wrangler secret put
#   scripts/rotate-jwt-secret.sh --staging [<secret>]  # staging workers (--env staging)
#
# NOTE: deployed worker secrets are normally GitHub-managed — deploy-workers.yml syncs
# JWT_SECRET from the GitHub Environment (Prod/Staging Cloudflare) onto the
# workers on every deploy (scripts/sync-cloudflare-worker-secrets.sh). The
# --prod/--staging paths here are a manual/emergency route; the NEXT deploy
# reconciles the worker back to the GitHub Environment secret, so to rotate for
# real also update that secret (`gh secret set JWT_SECRET --env "<env>"`).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGES=(api web admin)
MODE="dev"
ENV_LABEL=""
WENV=() # extra wrangler args selecting the named env (empty = default/prod)
SECRET=""

case "${1:-}" in
	--prod) MODE="remote"; ENV_LABEL="prod"; SECRET=${2:-} ;;
	--staging) MODE="remote"; ENV_LABEL="staging"; WENV=(--env staging); SECRET=${2:-} ;;
	"") : ;;
	*) SECRET=$1 ;;
esac

if [ -z "$SECRET" ]; then
	if ! command -v openssl >/dev/null 2>&1; then
		echo "openssl missing"
		exit 1
	fi
	SECRET=$(openssl rand -hex 32)
fi

if [ "$MODE" = "remote" ]; then
	echo "Verifying Cloudflare login via \`wrangler whoami\`..."
	if ! (cd "$ROOT/packages/api" && pnpm exec wrangler whoami >/dev/null 2>&1); then
		echo "Error: not logged in to Cloudflare. Run \`pnpm wrangler login\` first." >&2
		exit 1
	fi
	for pkg in "${PACKAGES[@]}"; do
		echo "    @ak5/$pkg ($ENV_LABEL)"
		(cd "$ROOT/packages/$pkg" && printf '%s' "$SECRET" | pnpm exec wrangler secret put JWT_SECRET "${WENV[@]}")
	done
	echo "JWT_SECRET rotated on $ENV_LABEL api, web, admin. All existing $ENV_LABEL cookies invalidated."
	echo "REMINDER: update the GitHub Environment secret too, or the next deploy reverts this."
	exit 0
fi

for pkg in "${PACKAGES[@]}"; do
	env_file="$ROOT/packages/$pkg/.env"
	[ -f "$env_file" ] || continue
	tmp=$(mktemp)
	grep -v "^JWT_SECRET=" "$env_file" > "$tmp" || true
	echo "JWT_SECRET=$SECRET" >> "$tmp"
	mv "$tmp" "$env_file"
	echo "    updated $pkg/.env"
done

echo "JWT_SECRET rotated across local api, web, admin .env (matching value)."
echo "REMINDER: deployed envs are GitHub-managed — to rotate staging/prod, update"
echo "the GitHub Environment secret (\`gh secret set JWT_SECRET --env \"<env>\"\`) and"
echo "redeploy, or use --prod / --staging for a manual push."
