import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { parseCookie, refreshJwt, signJwt, verifyJwt } from '@ak5/shared';
import { db as makeDb } from './index';
import { createTestDatabase } from './testing';
import { adminUsers, authEmail, tokens, users } from './schema';
import { app } from '../app';
import { loginUserPreAuth, loginAdminPreAuth, acceptInvitePreAuth } from '../lib/auth-prelogin';
import { changePasswordPostAuth } from '../lib/auth-postlogin';
import { adminStartImpersonation } from '../lib/admin-users';
import { hashPassword, verifyPassword } from '../lib/password';
import { issueToken } from '../lib/tokens';
import { authorizeSync } from '../lib/sync-auth';
import type { Env } from '../types';

test('credential changes revoke old sessions, refreshed copies, recovery links and impersonations', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const db = makeDb(local.binding);
	const env = {
		DB: local.binding,
		JWT_SECRET: 'session-test-secret',
		COOKIE_ORIGIN: 'localhost',
		PUBLIC_APP_URL: 'https://app.example.test',
		PUBLIC_ADMIN_URL: 'https://admin.example.test'
	} as Env;
	const password = 'Original-password-123!';
	await db.insert(users).values({
		id: 'user',
		publicId: 'u-owner00000',
		username: 'owner',
		email: 'user@example.test'
	});
	await db
		.insert(adminUsers)
		.values({ id: 'admin', publicId: 'a-admin', username: 'admin', email: 'admin@example.test' });
	await db.insert(authEmail).values(
		await Promise.all(
			(['user', 'admin'] as const).map(async (type) => ({
				subjectType: type,
				subjectId: type,
				email: `${type}@example.test`,
				passwordHashed: await hashPassword(password)
			}))
		)
	);
	const cookie = (header: string | null | undefined) => {
		const token = parseCookie(header, 'ak5_token');
		assert.ok(token);
		return token;
	};
	const status = async (token: string) =>
		(await app.request('/me', { headers: { cookie: `ak5_token=${token}` } }, env)).status;
	const sync = (token: string) =>
		authorizeSync(env, new Headers({ cookie: `ak5_token=${token}` }), 'notes-v1-u-owner00000');
	let currentUserToken = '';
	for (const type of ['user', 'admin'] as const) {
		const login = type === 'user' ? loginUserPreAuth : loginAdminPreAuth;
		const result = await login(db, env, { email: `${type}@example.test`, password });
		assert.ok(result.ok);
		const old = cookie(result.setCookie);
		assert.equal(await status(old), 200);
		const claims = (await verifyJwt(env.JWT_SECRET, old))!;
		const owner = type === 'user' ? { userId: type } : { adminId: type };
		await issueToken(db, owner, 'magic_login', 'outstanding-magic', new Date(Date.now() + 60_000));
		await issueToken(
			db,
			owner,
			'reset_password',
			'outstanding-reset',
			new Date(Date.now() + 60_000)
		);
		let impersonation = '';
		if (type === 'user') assert.equal(await sync(old), true);
		else {
			const started = await adminStartImpersonation(db, {
				adminPublicId: 'a-admin',
				targetPublicId: 'u-owner00000',
				adminToken: old,
				jwtSecret: env.JWT_SECRET,
				publicAppUrl: env.PUBLIC_APP_URL
			});
			assert.ok(started.ok);
			impersonation = started.result.impersonationToken;
			assert.equal(await status(impersonation), 200);
			assert.equal(await sync(impersonation), true);
		}
		const changed = await app.request(
			'/auth/change-password',
			{
				method: 'POST',
				headers: { cookie: `ak5_token=${old}`, 'content-type': 'application/json' },
				body: JSON.stringify({ currentPassword: password, newPassword: 'Changed-password-456!' })
			},
			env
		);
		assert.equal(changed.status, 200);
		const current = cookie(changed.headers.get('set-cookie'));
		assert.equal(await status(current), 200);
		assert.equal(await status(old), 401);
		assert.equal(await status(await refreshJwt(claims, env.JWT_SECRET)), 401);
		assert.equal((await login(db, env, { email: `${type}@example.test`, password })).ok, false);
		const relogin = await login(db, env, {
			email: `${type}@example.test`,
			password: 'Changed-password-456!'
		});
		assert.ok(relogin.ok);
		assert.equal(await status(cookie(relogin.setCookie)), 200);
		assert.equal((await db.select().from(tokens)).length, 0);
		if (type === 'user') {
			assert.equal(await sync(old), false);
			assert.equal(await sync(current), true);
		} else {
			assert.equal(await status(impersonation), 401);
			assert.equal(await sync(impersonation), false);
		}
		await issueToken(db, owner, 'reset_password', 'fresh-reset', new Date(Date.now() + 60_000));
		const reset = await acceptInvitePreAuth(db, env, {
			token: 'fresh-reset',
			password: 'Reset-password-789!'
		});
		assert.ok(reset.ok);
		const resetToken = cookie(reset.setCookie);
		assert.equal(await status(resetToken), 200);
		assert.equal(await status(current), 401);
		assert.equal((await verifyJwt(env.JWT_SECRET, resetToken))?.sessionVersion, 2);
		if (type === 'user') currentUserToken = resetToken;
	}

	await t.test(
		'a failed version update rolls back the password and preserves recovery links',
		async () => {
			await issueToken(
				db,
				{ userId: 'user' },
				'reset_password',
				'keep-on-failure',
				new Date(Date.now() + 60_000)
			);
			await local.binding
				.prepare(
					"CREATE TRIGGER reject_session_update BEFORE UPDATE OF session_version ON users BEGIN SELECT RAISE(ABORT, 'test failure'); END"
				)
				.run();
			await assert.rejects(
				changePasswordPostAuth(db, env, (await verifyJwt(env.JWT_SECRET, currentUserToken))!, {
					currentPassword: 'Reset-password-789!',
					newPassword: 'Should-not-commit-123!'
				})
			);
			const identity = await db.query.authEmail.findFirst({
				where: eq(authEmail.subjectId, 'user')
			});
			assert.ok(identity);
			assert.equal(await verifyPassword(identity.passwordHashed, 'Reset-password-789!'), true);
			assert.equal(await status(currentUserToken), 200);
			assert.equal((await db.select().from(tokens)).length, 1);
			await local.binding.prepare('DROP TRIGGER reject_session_update').run();
		}
	);

	await t.test('setting the first password also revokes the password-free session', async () => {
		await db.insert(users).values({
			id: 'oauth',
			publicId: 'u-oauth00000',
			username: 'oauth',
			email: 'oauth@example.test'
		});
		const old = await signJwt(env.JWT_SECRET, {
			sub: 'u-oauth00000',
			email: 'oauth@example.test',
			type: 'user',
			emailConfirmed: true,
			hasPassword: false,
			recentAuthAt: Math.floor(Date.now() / 1000)
		});
		const set = await app.request(
			'/auth/set-password',
			{
				method: 'POST',
				headers: { cookie: `ak5_token=${old}`, 'content-type': 'application/json' },
				body: JSON.stringify({ newPassword: 'First-password-123!' })
			},
			env
		);
		assert.equal(set.status, 200);
		assert.equal(await status(old), 401);
		assert.equal(await status(cookie(set.headers.get('set-cookie'))), 200);
	});
});
