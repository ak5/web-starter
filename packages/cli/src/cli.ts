#!/usr/bin/env tsx
/**
 * @ak5/cli — dev CLI wrapping the api endpoints.
 *
 * Multi-persona identity store at $XDG_CONFIG_HOME/ak5-cli/identities.json so a
 * developer can keep `--user` and `--admin` sessions side-by-side without
 * re-login thrash.
 *
 * Usage:
 *   pnpm cli help
 *   pnpm cli login user@example.com password
 *   pnpm cli login admin@example.com pw --type admin
 *   pnpm cli whoami
 *   pnpm cli token                       # raw JWT for Playwright cookie injection
 *   pnpm cli admin users                 # admin: list users
 *   pnpm cli emails to user@example.com  # query mock email server
 *   pnpm cli verify user@example.com     # auto-extract PIN + verify
 *
 * Per-worktree identities: when run via `pnpm cli`, mise sets XDG_CONFIG_HOME to
 * <worktree>/.ak5-config so two checkouts don't share sessions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface Identity {
	persona: string;
	type: 'user' | 'admin';
	email: string;
	token: string;
	apiUrl: string;
	createdAt: string;
}

interface IdentitiesFile {
	identities: Identity[];
}

type SlotEnv = Record<string, string>;

const args = process.argv.slice(2);

function readSlotEnv(): SlotEnv {
	let dir = process.cwd();
	while (true) {
		const file = join(dir, '.env.dev-slot');
		if (existsSync(file)) {
			const entries: SlotEnv = {};
			for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
				if (!line || line.startsWith('#')) continue;
				const index = line.indexOf('=');
				if (index === -1) continue;
				entries[line.slice(0, index)] = line.slice(index + 1);
			}
			return entries;
		}

		const parent = dirname(dir);
		if (parent === dir) return {};
		dir = parent;
	}
}

const slotEnv = readSlotEnv();

function parseFlags(rest: string[]) {
	const out: {
		persona: string;
		pretty: boolean;
		type: 'user' | 'admin' | undefined;
		prod: boolean;
		positional: string[];
	} = {
		persona: 'default',
		pretty: false,
		type: undefined,
		prod: false,
		positional: []
	};
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === '-i' || a === '--persona') {
			out.persona = rest[++i] ?? 'default';
		} else if (a === '--pretty') {
			out.pretty = true;
		} else if (a === '--type') {
			const t = rest[++i];
			if (t === 'user' || t === 'admin') out.type = t;
		} else if (a === '--prod') {
			out.prod = true;
		} else {
			out.positional.push(a);
		}
	}
	return out;
}

function configHome(): string {
	const xdg = process.env.XDG_CONFIG_HOME;
	if (xdg) return xdg;
	return join(process.env.HOME ?? '', '.config');
}

function identitiesPath(prod: boolean): string {
	const file = prod ? 'identities-prod.json' : 'identities.json';
	return join(configHome(), 'ak5-cli', file);
}

function loadIdentities(prod: boolean): IdentitiesFile {
	const path = identitiesPath(prod);
	if (!existsSync(path)) return { identities: [] };
	try {
		return JSON.parse(readFileSync(path, 'utf-8')) as IdentitiesFile;
	} catch {
		return { identities: [] };
	}
}

function saveIdentities(file: IdentitiesFile, prod: boolean) {
	const path = identitiesPath(prod);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(file, null, 2));
}

function getIdentity(persona: string, prod: boolean): Identity | undefined {
	return loadIdentities(prod).identities.find((i) => i.persona === persona);
}

function defaultApiUrl(prod: boolean): string {
	if (prod) return 'https://api.ak5web.com';
	return (
		process.env.AK5_API_URL ??
		slotEnv.AK5_API_URL ??
		slotEnv.PUBLIC_API_URL ??
		'http://api.ak5.localhost:8359'
	);
}

function defaultMockUrl(): string {
	return process.env.AK5_MOCK_URL ?? slotEnv.AK5_MOCK_URL ?? 'http://mock.ak5.localhost:8359';
}

async function callApi(
	method: string,
	path: string,
	identity: Identity | undefined,
	body?: unknown
): Promise<{ status: number; data: unknown; cookies: string[] }> {
	const apiUrl = identity?.apiUrl ?? defaultApiUrl(false);
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (identity) headers.cookie = `ak5_token=${identity.token}`;
	const res = await fetch(`${apiUrl}${path}`, {
		method,
		headers,
		body: body == null ? undefined : JSON.stringify(body)
	});
	const cookies = res.headers.getSetCookie?.() ?? [];
	let data: unknown;
	const text = await res.text();
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}
	return { status: res.status, data, cookies };
}

function jwtFromCookies(cookies: string[]): string | undefined {
	for (const c of cookies) {
		const m = /^ak5_token=([^;]+)/.exec(c);
		if (m) return m[1];
	}
	return undefined;
}

function out(data: unknown, pretty: boolean) {
	if (pretty) {
		console.log(JSON.stringify(data, null, 2));
	} else {
		console.log(JSON.stringify(data));
	}
}

function help() {
	console.log(`Usage: pnpm cli [-i persona] [--pretty] [--prod] <command> [...args]

Commands:
  help                                 — show this help
  login <email> <password>             — sign in (use --type admin for admin)
  forgot-password <email>             — request recovery (use --type admin for admin)
  logout                               — clear current persona
  list-identities                      — list stored personas
  whoami                               — print current persona info (GET /auth/me)
  token                                — print raw JWT (for Playwright injection)
  admin users                          — admin: list users
  emails to <addr>                     — list emails captured by mock server
  emails pin <addr>                    — extract verify PIN from latest email
  verify <addr>                        — auto-extract PIN + post /auth/verify-email

Personas:
  -i admin   pick a stored identity named "admin"
  --type     login under user/admin role

Environment:
  AK5_API_URL             override default api URL (defaults to dev caddy)
  AK5_MOCK_URL            override mock email URL (defaults to dev caddy)
  .env.dev-slot           generated dev URLs when env overrides are not set
  XDG_CONFIG_HOME         where identities are stored (mise sets this per-worktree)
`);
}

async function main() {
	const flags = parseFlags(args);
	const cmd = flags.positional[0];
	if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return help();

	const identity = getIdentity(flags.persona, flags.prod);

	if (cmd === 'forgot-password') {
		const email = flags.positional[1];
		if (!email) {
			console.error('forgot-password requires <email>');
			process.exit(2);
		}
		const path = flags.type === 'admin' ? '/auth/admin/forgot-password' : '/auth/forgot-password';
		const response = await fetch(`${defaultApiUrl(flags.prod)}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email })
		});
		out(await response.json(), flags.pretty);
		if (!response.ok) process.exit(1);
		return;
	}

	if (cmd === 'login') {
		const email = flags.positional[1];
		const password = flags.positional[2];
		if (!email || !password) {
			console.error('login requires <email> <password>');
			process.exit(2);
		}
		const path = flags.type === 'admin' ? '/auth/admin/login' : '/auth/login';
		const apiUrl = defaultApiUrl(flags.prod);
		const res = await fetch(`${apiUrl}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		if (!res.ok) {
			out({ status: res.status, error: data }, flags.pretty);
			process.exit(1);
		}
		const cookies = res.headers.getSetCookie?.() ?? [];
		const token = jwtFromCookies(cookies);
		if (!token) {
			console.error('login response had no ak5_token cookie');
			process.exit(1);
		}
		const file = loadIdentities(flags.prod);
		const next: Identity = {
			persona: flags.persona,
			type: flags.type ?? 'user',
			email,
			token,
			apiUrl,
			createdAt: new Date().toISOString()
		};
		file.identities = file.identities.filter((i) => i.persona !== flags.persona).concat(next);
		saveIdentities(file, flags.prod);
		out({ ok: true, persona: flags.persona, type: next.type }, flags.pretty);
		return;
	}

	if (cmd === 'logout') {
		const file = loadIdentities(flags.prod);
		file.identities = file.identities.filter((i) => i.persona !== flags.persona);
		saveIdentities(file, flags.prod);
		out({ ok: true, persona: flags.persona }, flags.pretty);
		return;
	}

	if (cmd === 'list-identities') {
		const file = loadIdentities(flags.prod);
		const items = file.identities.map((i) => ({
			persona: i.persona,
			type: i.type,
			email: i.email,
			apiUrl: i.apiUrl,
			createdAt: i.createdAt
		}));
		if (flags.pretty) {
			for (const it of items) {
				console.log(`${it.persona.padEnd(12)} ${it.type.padEnd(6)} ${it.email}  ${it.apiUrl}`);
			}
		} else out(items, false);
		return;
	}

	if (cmd === 'token') {
		if (!identity) {
			console.error(`no identity for persona "${flags.persona}" — run \`cli login\` first`);
			process.exit(1);
		}
		console.log(identity.token);
		return;
	}

	if (cmd === 'whoami') {
		const r = await callApi('GET', '/auth/me', identity);
		out(r.data, flags.pretty);
		return;
	}

	if (cmd === 'admin') {
		const sub = flags.positional[1];
		if (sub === 'users') {
			const r = await callApi('GET', '/admin/users', identity);
			out(r.data, flags.pretty);
			return;
		}
		console.error(`unknown admin subcommand: ${sub}`);
		process.exit(2);
	}

	if (cmd === 'emails') {
		const sub = flags.positional[1];
		const addr = flags.positional[2];
		if (!sub || !addr) {
			console.error('emails {to|pin|magic-link} <address>');
			process.exit(2);
		}
		const mockBase = defaultMockUrl();
		const url =
			sub === 'to'
				? `${mockBase}/emails/to/${encodeURIComponent(addr)}`
				: sub === 'pin'
					? `${mockBase}/emails/to/${encodeURIComponent(addr)}/pin`
					: `${mockBase}/emails/to/${encodeURIComponent(addr)}/magic-link`;
		const res = await fetch(url);
		out(await res.json(), flags.pretty);
		return;
	}

	if (cmd === 'verify') {
		const addr = flags.positional[1];
		if (!addr || !identity) {
			console.error('verify <addr> requires logged-in persona and address');
			process.exit(2);
		}
		const mockBase = defaultMockUrl();
		const pinRes = await fetch(`${mockBase}/emails/to/${encodeURIComponent(addr)}/pin`);
		const { pin } = (await pinRes.json()) as { pin: string };
		const r = await callApi('POST', '/auth/verify-email', identity, { pin });
		out(r.data, flags.pretty);
		return;
	}

	console.error(`unknown command: ${cmd}`);
	help();
	process.exit(2);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
