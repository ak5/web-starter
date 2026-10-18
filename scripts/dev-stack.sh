#!/bin/bash
# Source the slot env and launch the dev stack. Local mode fronts every app
# through Caddy; tailnet mode binds apps directly to 0.0.0.0.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLOT_FILE="$REPO_ROOT/.env.dev-slot"
CADDY_FILE="$REPO_ROOT/.caddy/Caddyfile"
cd "$REPO_ROOT"

if [ ! -f "$SLOT_FILE" ]; then
	echo "Error: $SLOT_FILE missing — scripts/dev-host.sh must run first." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
. "$SLOT_FILE"
set +a

if [ "$DEV_MODE" = "tailscale" ]; then
	export DEV_HOST=0.0.0.0
	exec pnpm exec concurrently \
		-n shared,webui,email,api,web,admin,email-mock,email-preview,ready \
		-c gray,gray,gray,blue,green,yellow,magenta,white,greenBright \
		"pnpm dev:shared" \
		"pnpm dev:webui" \
		"pnpm dev:email" \
		"pnpm dev:api" \
		"pnpm dev:web" \
		"pnpm dev:admin" \
		"pnpm dev:email:mock" \
		"pnpm dev:email:preview" \
		"bash $REPO_ROOT/scripts/dev-banner.sh"
else
	export DEV_HOST=127.0.0.1
	if [ ! -f "$CADDY_FILE" ]; then
		echo "Error: $CADDY_FILE missing — scripts/dev-host.sh must run first." >&2
		exit 1
	fi
	exec pnpm exec concurrently \
		-n shared,webui,email,api,web,admin,email-mock,email-preview,caddy,ready \
		-c gray,gray,gray,blue,green,yellow,magenta,white,red,greenBright \
		"pnpm dev:shared" \
		"pnpm dev:webui" \
		"pnpm dev:email" \
		"pnpm dev:api" \
		"pnpm dev:web" \
		"pnpm dev:admin" \
		"pnpm dev:email:mock" \
		"pnpm dev:email:preview" \
		"caddy run --config $CADDY_FILE --adapter caddyfile" \
		"bash $REPO_ROOT/scripts/dev-banner.sh"
fi
