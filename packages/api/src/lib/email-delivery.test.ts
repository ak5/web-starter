import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCookie, verifyJwt, type JwtPayload } from '@ak5/shared';
import type { Database } from '../db';
import { auditLog, users, adminUsers, tokens } from '../db/schema';
import type { Env } from '../types';
import {
	registerUserPreAuth,
	forgotUserPasswordPreAuth,
	forgotAdminPasswordPreAuth
} from './auth-prelogin';
import { resendVerificationPostAuth, requestReauthPostAuth } from './auth-postlogin';
import { adminInviteAccount } from './admin-users';
import { handleDiscordOAuthCallback } from './oauth/discord';

const auth: JwtPayload = {
	sub: 'u-test',
	email: 'private@example.test',
	name: 'tester',
	type: 'user',
	emailConfirmed: false,
	hasPassword: true,
	recentAuthAt: 1
};
const baseEnv = {
	JWT_SECRET: 'test-secret',
	COOKIE_ORIGIN: 'localhost',
	PUBLIC_APP_URL: 'https://example.test',
	PUBLIC_ADMIN_URL: 'https://admin.example.test',
	PUBLIC_EMAIL_FROM: 'sender@example.test',
	TOKEN_ENCRYPTION_KEY: 'ab'.repeat(32),
	PUBLIC_API_URL: 'https://api.example.test'
} as Env;

function database(options: { existing?: boolean; active?: boolean; invite?: boolean } = {}) {
	const writes: { table: unknown; value: Record<string, unknown> }[] = [];
	let committed = false;
	let adminReads = 0;
	const db = {
		query: {
			users: {
				findFirst: async () =>
					options.active ? { id: 'user-internal', deletedAt: null, bannedAt: null } : undefined
			},
			adminUsers: {
				findFirst: async () =>
					options.invite && adminReads++ === 0
						? { id: 'actor-internal', publicId: 'a-actor', username: 'admin' }
						: undefined
			},
			authEmail: {
				findFirst: async () => (options.existing ? { subjectId: 'user-internal' } : undefined)
			},
			authDiscord: { findFirst: async () => undefined }
		},
		insert: (table: unknown) => ({
			values: async (value: Record<string, unknown>) => {
				writes.push({ table, value });
			}
		}),
		transaction: async (run: (tx: unknown) => Promise<void>) => {
			await run(db);
			committed = true;
		}
	};
	return { db: db as unknown as Database, writes, isCommitted: () => committed };
}

function failingEnv(onSend?: () => void): Env {
	return {
		...baseEnv,
		EMAIL: {
			send: async () => {
				onSend?.();
				throw Object.assign(Error('private provider body'), { code: 'E_SENDER_NOT_VERIFIED' });
			}
		}
	};
}

test('signup delivery failure keeps committed account, unconfirmed session, and retry access', async (t) => {
	t.mock.method(console, 'error', () => {});
	const state = database();
	let committedAtSend = false;
	const result = await registerUserPreAuth(
		state.db,
		failingEnv(() => {
			committedAtSend = state.isCommitted();
		}),
		{ username: 'tester', email: auth.email, password: 'password123', legalAcceptance: true }
	);
	assert.equal(committedAtSend, true);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.body.verificationEmailSent, false);
	const cookie = parseCookie(result.setCookie, 'ak5_token');
	assert.ok(cookie);
	const payload = await verifyJwt(baseEnv.JWT_SECRET, cookie);
	assert.equal(payload?.emailConfirmed, false);
	assert.equal(payload?.email, auth.email);
	assert.ok(state.writes.some(({ table }) => table === users));
	assert.ok(state.writes.some(({ table }) => table === tokens));
});

for (const recover of [forgotUserPasswordPreAuth, forgotAdminPasswordPreAuth]) {
	test(`${recover.name}: known and unknown accounts have identical public responses on failed delivery`, async (t) => {
		t.mock.method(console, 'error', () => {});
		const pending: Promise<unknown>[] = [];
		const known = await recover(
			database({ existing: true }).db,
			failingEnv(),
			{ email: auth.email },
			(p) => pending.push(p)
		);
		const unknown = await recover(database().db, failingEnv(), { email: auth.email }, (p) =>
			pending.push(p)
		);
		assert.deepEqual(known, unknown);
		assert.equal(pending.length, 1);
		assert.deepEqual(
			(await Promise.allSettled(pending)).map((r) => r.status),
			['fulfilled']
		);
	});
}

for (const send of [resendVerificationPostAuth, requestReauthPostAuth]) {
	test(`${send.name}: authenticated failure is 503 and a successful retry succeeds`, async (t) => {
		t.mock.method(console, 'error', () => {});
		const state = database({ active: true });
		assert.deepEqual(await send(state.db, failingEnv(), auth), {
			ok: false,
			status: 503,
			body: { error: 'email_delivery_failed' }
		});
		const retry = await send(
			state.db,
			{ ...baseEnv, EMAIL: { send: async () => ({ messageId: 'retry-id' }) } },
			auth
		);
		assert.equal(retry.ok, true);
		assert.equal('error' in retry.body, false);
	});
}

for (const role of ['user', 'admin'] as const) {
	test(`inviting ${role}: account and audit commit before failed delivery`, async (t) => {
		t.mock.method(console, 'error', () => {});
		const state = database({ invite: true });
		let committedAtSend = false;
		let auditedAtSend = false;
		let accountAtSend = false;
		const result = await adminInviteAccount(
			state.db,
			failingEnv(() => {
				committedAtSend = state.isCommitted();
				accountAtSend = state.writes.some(
					({ table }) => table === (role === 'user' ? users : adminUsers)
				);
				auditedAtSend = state.writes.some(
					({ table, value }) =>
						table === auditLog &&
						value.action === (role === 'user' ? 'user.invite' : 'admin_user.invite')
				);
			}),
			'a-actor',
			{ email: auth.email, username: 'invitee', role }
		);
		assert.equal(committedAtSend, true);
		assert.equal(accountAtSend, true);
		assert.equal(auditedAtSend, true);
		assert.deepEqual(result, { ok: false, status: 503, error: 'invitation_delivery_failed' });
	});
}

test('direct Discord signup relies on verified provider email and issues a session without mail', async (t) => {
	let sent = false;
	t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => {
		if (String(url).includes('/oauth2/token'))
			return Response.json({
				access_token: 'test-access',
				refresh_token: 'test-refresh',
				expires_in: 3600,
				token_type: 'Bearer'
			});
		assert.equal(String(url), 'https://discord.com/api/users/@me');
		return Response.json({
			id: 'discord-id',
			username: 'tester',
			email: auth.email,
			verified: true
		});
	});
	const result = await handleDiscordOAuthCallback({
		db: database().db,
		env: failingEnv(() => {
			sent = true;
		}),
		auth: null,
		code: 'test-code',
		acceptedLegal: true
	});
	assert.equal(result.kind, 'login');
	if (result.kind === 'login') assert.equal(result.jwtPayload.emailConfirmed, true);
	assert.equal(sent, false);
});
