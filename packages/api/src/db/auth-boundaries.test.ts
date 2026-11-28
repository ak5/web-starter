import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { db as makeDb } from './index';
import { createTestDatabase } from './testing';
import { users, adminUsers } from './schema';
import { issueToken, consumeToken } from '../lib/tokens';
import { verifyEmailPostAuth, magicLoginPostAuth } from '../lib/auth-postlogin';
import { app } from '../app';
import { signJwt } from '../lib/jwt';
import type { Env } from '../types';

test('auth boundaries preserve other subjects and reject inactive accounts', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const db = makeDb(local.binding);
	await db.insert(users).values([
		{ id: 'alice', publicId: 'u-alice', username: 'alice' },
		{ id: 'bob', publicId: 'u-bob', username: 'bob' },
		{ id: 'banned', publicId: 'u-banned', username: 'banned', bannedAt: new Date() },
		{ id: 'deleted', publicId: 'u-deleted', username: 'deleted', deletedAt: new Date() }
	]);
	await db.insert(adminUsers).values({
		id: 'admin',
		publicId: 'a-admin',
		username: 'admin',
		email: 'admin@example.test',
		deletedAt: new Date()
	});
	const env = {
		DB: local.binding,
		JWT_SECRET: 'auth-boundary-test-secret',
		COOKIE_ORIGIN: 'localhost'
	} as Env;
	const claims = {
		sub: 'u-alice',
		email: 'alice@example.test',
		type: 'user' as const,
		emailConfirmed: false,
		hasPassword: true,
		recentAuthAt: Math.floor(Date.now() / 1000)
	};
	const staleToken = await signJwt(env.JWT_SECRET, {
		...claims,
		recentAuthAt: Math.floor(Date.now() / 1000) - 3600
	});
	const deletion = await app.request(
		'/me',
		{
			method: 'DELETE',
			headers: { cookie: `ak5_token=${staleToken}` }
		},
		env
	);
	assert.equal(deletion.status, 403);
	assert.equal(((await deletion.json()) as { code: string }).code, 'recent_auth_required');
	assert.equal((await db.query.users.findFirst({ where: eq(users.id, 'alice') }))?.deletedAt, null);
	for (const purpose of ['verify_email', 'magic_login'] as const) {
		const plain = `${purpose}-test`;
		await issueToken(db, { userId: 'bob' }, purpose, plain, new Date(Date.now() + 60_000));
		const attempt = purpose === 'verify_email' ? verifyEmailPostAuth : magicLoginPostAuth;
		assert.equal((await attempt(db, env, claims, plain)).ok, false);
		assert.ok(await consumeToken(db, purpose, plain, { userId: 'bob' }));
	}
	await issueToken(db, { userId: 'bob' }, 'verify_email', 'SAMEPIN', new Date(Date.now() + 60_000));
	await issueToken(
		db,
		{ userId: 'alice' },
		'verify_email',
		'SAMEPIN',
		new Date(Date.now() + 60_000)
	);
	assert.equal((await verifyEmailPostAuth(db, env, claims, 'SAMEPIN')).ok, true);
	assert.ok(await consumeToken(db, 'verify_email', 'SAMEPIN', { userId: 'bob' }));
	for (const [sub, type, status] of [
		['a-admin', 'admin', 401],
		['u-deleted', 'user', 401],
		['u-banned', 'user', 403]
	] as const) {
		const token = await signJwt(env.JWT_SECRET, { ...claims, sub, type });
		const headers = { cookie: `ak5_token=${token}` };
		const logout = await app.request('/auth/logout', { method: 'POST', headers }, env);
		assert.equal(logout.status, 200);
		assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);
		assert.equal((await app.request('/me', { headers }, env)).status, status);
		assert.equal((await app.request('/auth/me', { headers }, env)).status, status);
		assert.equal(
			(
				await app.request(
					'/me/profile',
					{
						method: 'PATCH',
						headers: { ...headers, 'content-type': 'application/json' },
						body: JSON.stringify({ displayName: 'should not change' })
					},
					env
				)
			).status,
			status
		);
	}
	const token = await signJwt(env.JWT_SECRET, claims);
	const orphanedImpersonation = await signJwt(env.JWT_SECRET, {
		...claims,
		impersonatedBy: 'a-admin'
	});
	assert.equal(
		(
			await app.request(
				'/me',
				{
					headers: { cookie: `ak5_token=${orphanedImpersonation}` }
				},
				env
			)
		).status,
		401,
		'deleted admins cannot keep impersonating users'
	);
	await db.update(adminUsers).set({ deletedAt: null }).where(eq(adminUsers.id, 'admin'));
	assert.equal(
		(
			await app.request(
				'/me',
				{
					headers: { cookie: `ak5_token=${orphanedImpersonation}` }
				},
				env
			)
		).status,
		200,
		'active admins can impersonate'
	);
	assert.equal(
		(await app.request('/me', { headers: { cookie: `ak5_token=${token}` } }, env)).status,
		200
	);
	for (const value of ['%ZZ', 'a.b.%%%', 'a.b.a']) {
		const headers = { cookie: `ak5_token=${value}` };
		assert.equal((await app.request('/healthz', { headers }, env)).status, 200);
		assert.equal((await app.request('/me', { headers }, env)).status, 401);
	}
});

test('logout everywhere revokes the current role and its pending recovery tokens', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const db = makeDb(local.binding);
	const env = {
		DB: local.binding,
		JWT_SECRET: 'logout-everywhere-test',
		COOKIE_ORIGIN: 'localhost'
	} as Env;
	await db.insert(users).values({ id: 'shared-id', publicId: 'u-owner', username: 'owner' });
	await db.insert(adminUsers).values({
		id: 'shared-id',
		publicId: 'a-owner',
		username: 'owner',
		email: 'owner@example.test'
	});
	const recentAuthAt = Math.floor(Date.now() / 1000);
	for (const type of ['user', 'admin'] as const) {
		const sub = type === 'user' ? 'u-owner' : 'a-owner';
		const target = type === 'user' ? { userId: 'shared-id' } : { adminId: 'shared-id' };
		await issueToken(
			db,
			target,
			'reset_password',
			type + '-recovery',
			new Date(Date.now() + 60_000)
		);
		const headers = async (lastAuth: number) => ({
			cookie:
				'ak5_token=' +
				(await signJwt(env.JWT_SECRET, {
					type,
					sub,
					email: 'owner@example.test',
					hasPassword: true,
					name: 'owner',
					emailConfirmed: true,
					recentAuthAt: lastAuth
				}))
		});
		const stale = await app.request(
			'/auth/logout-all',
			{ method: 'POST', headers: await headers(recentAuthAt - 3600) },
			env
		);
		assert.equal(stale.status, 403);
		const currentHeaders = await headers(recentAuthAt);
		assert.equal(
			(await app.request('/auth/logout-all', { method: 'POST', headers: currentHeaders }, env))
				.status,
			400
		);
		const result = await app.request(
			'/auth/logout-all',
			{
				method: 'POST',
				headers: { ...currentHeaders, 'content-type': 'application/json' },
				body: JSON.stringify({ confirm: true })
			},
			env
		);
		assert.equal(result.status, 200);
		assert.match(result.headers.get('set-cookie') ?? '', /Max-Age=0/);
		assert.equal((await app.request('/auth/me', { headers: currentHeaders }, env)).status, 401);
		assert.equal(await consumeToken(db, 'reset_password', type + '-recovery', target), null);
	}
});
