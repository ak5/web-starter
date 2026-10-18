#!/usr/bin/env tsx
/**
 * db:reset — reset your Neon dev branch back to its parent (dev-template).
 *
 * Usage:
 *   pnpm db:reset
 *
 * --- How it works ---------------------------------------------------------
 * Reads DATABASE_URL from packages/api/.env, extracts the Neon endpoint id
 * from the host (strips the -pooler suffix if present), and POSTs to the
 * unauthenticated POST /dev/db-branches/:endpointId/reset on the prod API.
 * The prod API is where NEON_API_KEY lives — it resolves endpoint → branch
 * via Neon, applies the protection guard, then calls Neon's `/restore` API.
 *
 * --- Why no auth ----------------------------------------------------------
 * The Neon endpoint id is the capability. It's ~60 bits of random base36
 * entropy and it's already in your DATABASE_URL, so anyone who has your
 * connection string can already do everything to your fork — adding a
 * bearer token on top would be security theater. Runs through prod because
 * NEON_API_KEY is prod-only; we don't want to hand it to collaborators.
 *
 * --- What it refuses (server-side) ----------------------------------------
 * After resolving endpoint → branch, the prod API applies `isProtectedBranch`
 * in packages/api/src/lib/neon.ts, which refuses:
 *   - production (branch.default === true / branch.primary === true)
 *   - dev-template and any other root branch (branch.parent_id is null)
 *   - any branch name matching /^(main|prod|production|default)$/i
 * So pointing your .env at production by accident returns 403 — no damage.
 * Pointing at dev-template returns 403 — can't wipe the template either.
 * Only forks off dev-template (which have parent_id set) are resettable.
 *
 * --- Rate limit -----------------------------------------------------------
 * 1 reset per 10s per endpoint id, in-memory on the prod API worker. Bounds
 * accidental double-clicks and shell loops. Cross-isolate bypass is possible
 * but bounded by the protection guard above, so the blast radius is still
 * "one collaborator's fork keeps resetting itself."
 *
 * --- Environment overrides ------------------------------------------------
 *   CR_PROD_API_URL — override the prod API host
 *                     (default: https://api.ak5web.com)
 *
 * --- Exit codes -----------------------------------------------------------
 *   0 — reset accepted (eventually-consistent; Neon completes asynchronously)
 *   1 — missing or unparseable DATABASE_URL, or reset rejected by prod API
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { responseJson } from '../src/lib/request-parsing';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');

let envText: string;
try {
	envText = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
	console.error(`Failed to read ${envPath}: ${(e as Error).message}`);
	process.exit(1);
}

// Extract the host portion of DATABASE_URL; the host is the Neon endpoint id
// (plus optional -pooler suffix plus region domain). Matches:
//   postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?...
//   postgres://user:pass@ep-example.eu-central-1.aws.neon.tech/neondb?...
const match = envText.match(
	/^\s*DATABASE_URL\s*=\s*["']?postgres(?:ql)?:\/\/[^@]+@([a-z0-9-]+)\./m
);
if (!match) {
	console.error(
		`No DATABASE_URL with a Neon endpoint host found in ${envPath}. Expected a URL like ` +
			`postgresql://user:pass@ep-xxx-yyy.region.aws.neon.tech/neondb?...`
	);
	process.exit(1);
}

// Strip the -pooler suffix if present — the endpoint id itself doesn't include it.
const endpointId = match[1].replace(/-pooler$/, '');

const apiUrl = process.env.CR_PROD_API_URL || 'https://api.ak5web.com';
const url = `${apiUrl}/dev/db-branches/${endpointId}/reset`;

console.log(`Resetting Neon endpoint ${endpointId} via ${apiUrl}…`);

const res = await fetch(url, { method: 'POST' });
const contentType = res.headers.get('content-type') ?? '';
const body = contentType.includes('application/json')
	? await responseJson<unknown>(res)
	: await res.text();

if (!res.ok) {
	if (typeof body === 'string' && body.includes('<html')) {
		console.error(
			`Reset failed (${res.status}): server returned HTML (likely a Cloudflare error page or the endpoint is not deployed).`
		);
	} else {
		console.error(
			`Reset failed (${res.status}):`,
			typeof body === 'string' ? body : JSON.stringify(body)
		);
	}
	process.exit(1);
}

if (typeof body === 'string' && body.includes('<html')) {
	console.error('Unexpected HTML response from server — endpoint may not be deployed.');
	process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
console.log(
	'\nReset accepted. Neon completes the operation asynchronously — allow a few seconds before reconnecting.'
);
