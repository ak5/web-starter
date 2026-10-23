#!/usr/bin/env tsx
/**
 * Preflight check for the Playwright suite. Verifies the four endpoints the
 * tests need (api, web, admin, mock) are reachable and exits with a focused
 * diagnostic when one isn't.
 *
 *   pnpm tsx scripts/preflight.ts
 *
 * Each endpoint is polled until it's up or a deadline passes, so the check
 * tolerates a dev stack that's still booting (CI does `pnpm dev &` then runs
 * this immediately). Tune the wait with PREFLIGHT_TIMEOUT_MS (default 90000).
 *
 * Skip with SKIP_PREFLIGHT=1 if you've already vetted the stack.
 */
import { existsSync, readFileSync } from 'node:fs';

type SlotEnv = Record<string, string>;

function readSlotEnv(): SlotEnv {
	const file = '.env.dev-slot';
	if (!existsSync(file)) return {};
	const entries: SlotEnv = {};
	for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
		if (!line || line.startsWith('#')) continue;
		const index = line.indexOf('=');
		if (index === -1) continue;
		entries[line.slice(0, index)] = line.slice(index + 1);
	}
	return entries;
}

const slotEnv = readSlotEnv();
const apiUrl =
	slotEnv.PUBLIC_API_URL ?? process.env.PUBLIC_API_URL ?? 'http://api.ak5.localhost:8359';
const webUrl =
	slotEnv.PUBLIC_WEB_URL ?? process.env.PUBLIC_WEB_URL ?? 'http://web.ak5.localhost:8359';
const adminUrl =
	slotEnv.PUBLIC_ADMIN_URL ?? process.env.PUBLIC_ADMIN_URL ?? 'http://admin.ak5.localhost:8359';
const mockUrl =
	slotEnv.AK5_MOCK_URL ?? process.env.AK5_MOCK_URL ?? 'http://mock.ak5.localhost:8359';

const TARGETS = [
	{ name: 'api', url: `${apiUrl}/healthz`, expectJson: { ok: true } },
	{ name: 'web', url: `${webUrl}/` },
	{ name: 'admin', url: `${adminUrl}/login` },
	{ name: 'mock', url: `${mockUrl}/emails` }
];

interface CheckResult {
	name: string;
	url: string;
	ok: boolean;
	status?: number;
	error?: string;
	bodyHint?: string;
}

async function check(target: (typeof TARGETS)[number]): Promise<CheckResult> {
	const ctrl = new AbortController();
	const timeout = setTimeout(() => ctrl.abort(), 5000);
	try {
		const r = await fetch(target.url, { signal: ctrl.signal, redirect: 'manual' });
		const ok = r.ok || r.status === 302 || r.status === 303;
		const result: CheckResult = { name: target.name, url: target.url, ok, status: r.status };
		if (target.expectJson && ok) {
			const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
			for (const [k, v] of Object.entries(target.expectJson)) {
				if (body[k] !== v) {
					result.ok = false;
					result.bodyHint = `expected ${k}=${v}, got ${JSON.stringify(body)}`;
				}
			}
		}
		if (!ok && r.status === 502) {
			result.bodyHint = 'Caddy returned 502 — upstream service is not bound on the expected port';
		}
		if (!r.bodyUsed) await r.body?.cancel();
		return result;
	} catch (e) {
		return {
			name: target.name,
			url: target.url,
			ok: false,
			error: e instanceof Error ? e.message : String(e)
		};
	} finally {
		clearTimeout(timeout);
	}
}

const TIMEOUT_MS = Number(process.env.PREFLIGHT_TIMEOUT_MS ?? 90_000);
const POLL_INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll one target until it's up or the deadline passes; return the last result. */
async function pollUntilUp(
	target: (typeof TARGETS)[number],
	deadline: number
): Promise<CheckResult> {
	let last = await check(target);
	while (!last.ok && Date.now() < deadline) {
		await sleep(POLL_INTERVAL_MS);
		last = await check(target);
	}
	return last;
}

async function main() {
	if (process.env.SKIP_PREFLIGHT === '1') {
		console.log('[preflight] SKIP_PREFLIGHT=1 — skipping');
		return;
	}

	const deadline = Date.now() + TIMEOUT_MS;
	const results = await Promise.all(TARGETS.map((t) => pollUntilUp(t, deadline)));
	const failures = results.filter((r) => !r.ok);

	for (const r of results) {
		const ok = r.ok ? 'OK ' : 'FAIL';
		const detail = r.status ? `(${r.status})` : r.error ? `(${r.error})` : '';
		console.log(`[preflight] ${ok} ${r.name.padEnd(6)} ${r.url} ${detail}`);
		if (r.bodyHint) console.log(`             ${r.bodyHint}`);
	}

	if (failures.length === 0) {
		console.log('[preflight] all systems go');
		return;
	}

	console.error('');
	console.error(`[preflight] dev stack not up after ${TIMEOUT_MS}ms. Diagnostics:`);
	for (const f of failures) {
		console.error(`  - ${f.name}: ${f.url}`);
		console.error(`    ${f.error ?? `status ${f.status}${f.bodyHint ? ` — ${f.bodyHint}` : ''}`}`);
	}
	console.error('');
	console.error('Fix:');
	console.error('  1. Make sure `pnpm dev` or `pnpm dev:slot N` is running in another terminal.');
	console.error('  2. Confirm `.env.dev-slot` matches that stack; rerun the dev command if not.');
	console.error('  3. Inspect the generated ports with `cat .env.dev-slot` and `lsof -i:<port>`.');
	process.exit(2);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
