import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { db as makeDb } from './index';
import { adminUsers, auditLog, authEmail, items, tokens, users } from './schema';
import { createTestDatabase } from './testing';
import { listAllItems } from '../lib/items';
import { adminHealthReport } from '../lib/admin-health';
import { consumeToken, issueToken } from '../lib/tokens';
import { registerUserPreAuth, loginUserPreAuth } from '../lib/auth-prelogin';
import { adminInviteAccount } from '../lib/admin-users';
import { softDeleteUserById } from '../lib/account-deletion';
import type { Env } from '../types';

test('D1 preserves identity constraints, atomic writes and auth workflows', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const db = makeDb(local.binding);
	await db
		.insert(users)
		.values({ id: 'owner', publicId: 'u-owner', username: 'owner', email: 'owner@example.test' });

	await t.test('JSON, dates and booleans round-trip through the real binding', async () => {
		const [row] = await db
			.insert(items)
			.values({
				publicId: 'i-json',
				userId: 'owner',
				data: { nested: { ok: true }, values: [1, 'two'] }
			})
			.returning();
		assert.deepEqual(row.data, { nested: { ok: true }, values: [1, 'two'] });
		assert.ok(row.createdAt instanceof Date);
		assert.equal(
			(await db.query.users.findFirst({ where: eq(users.id, 'owner') }))?.emailVerified,
			false
		);
	});

	await t.test('admin diagnostics and relational item reads execute on D1', async () => {
		const result = await listAllItems(db, 0, 0, 20);
		assert.equal(result.items[0].owner, 'owner');
		const health = await adminHealthReport(db);
		assert.equal(health.checks.find((check) => check.name === 'Database')?.status, 'ok');
	});

	await t.test(
		'foreign keys, exclusive arcs and database enums reject invalid writes',
		async () => {
			await assert.rejects(
				db.insert(items).values({ publicId: 'i-invalid', userId: 'missing' }).run()
			);
			await assert.rejects(
				db
					.insert(tokens)
					.values({ purpose: 'verify_email', tokenHash: 'invalid', expiresAt: new Date() })
					.run()
			);
			await assert.rejects(
				local.binding.prepare("UPDATE users SET role = 'invalid' WHERE id = 'owner'").run()
			);
			await assert.rejects(
				local.binding
					.prepare(
						"INSERT INTO auth_email (id, subject_type, subject_id, email, password_hashed) VALUES ('invalid', 'invalid', 'owner', 'invalid@example.test', 'hash')"
					)
					.run()
			);
		}
	);

	await t.test('a failed batch rolls back account creation', async () => {
		await assert.rejects(
			db.batch([
				db
					.insert(users)
					.values({ id: 'rolled-back', publicId: 'u-rolled-back', username: 'rollback' }),
				db.insert(items).values({ publicId: 'i-bad-fk', userId: 'missing' })
			])
		);
		assert.equal(await db.query.users.findFirst({ where: eq(users.id, 'rolled-back') }), undefined);
	});

	await t.test('tokens are single-use under concurrent consumption and reject expiry', async () => {
		await issueToken(
			db,
			{ userId: 'owner' },
			'reset_password',
			'one-time',
			new Date(Date.now() + 60_000)
		);
		const results = await Promise.all([
			consumeToken(db, 'reset_password', 'one-time'),
			consumeToken(db, 'reset_password', 'one-time')
		]);
		assert.equal(results.filter(Boolean).length, 1);
		await issueToken(
			db,
			{ userId: 'owner' },
			'reset_password',
			'expired',
			new Date(Date.now() - 1)
		);
		assert.equal(await consumeToken(db, 'reset_password', 'expired'), null);
	});

	const env = {
		DB: local.binding,
		JWT_SECRET: 'local-d1-test',
		COOKIE_ORIGIN: 'localhost',
		PUBLIC_APP_URL: 'https://example.test',
		PUBLIC_ADMIN_URL: 'https://admin.example.test',
		PUBLIC_EMAIL_FROM: 'sender@example.test',
		EMAIL: {
			send: async () => {
				throw Error('redacted');
			}
		}
	} as unknown as Env;
	t.mock.method(console, 'error', () => {});
	await t.test(
		'failed verification delivery leaves an unconfirmed account able to log in',
		async () => {
			const result = await registerUserPreAuth(db, env, {
				email: 'signup@example.test',
				username: 'signup',
				password: 'password1234',
				legalAcceptance: true
			});
			assert.equal(result.ok, true);
			if (!result.ok) return;
			assert.equal(result.body.verificationEmailSent, false);
			assert.ok(result.setCookie);
			assert.equal(
				(
					await loginUserPreAuth(db, env, {
						email: 'signup@example.test',
						password: 'password1234'
					})
				).ok,
				true
			);
		}
	);

	await t.test('invitation account and audit survive provider failure together', async () => {
		await db
			.insert(adminUsers)
			.values({ id: 'admin', publicId: 'a-admin', email: 'admin@example.test', username: 'admin' });
		const result = await adminInviteAccount(db, env, 'a-admin', {
			email: 'invite@example.test',
			username: 'invited'
		});
		assert.equal(result.ok, false);
		if (result.ok) return;
		assert.equal(result.status, 503);
		const account = await db.query.users.findFirst({
			where: eq(users.email, 'invite@example.test')
		});
		assert.ok(account);
		assert.ok(
			await db.query.auditLog.findFirst({ where: eq(auditLog.entityId, account.publicId) })
		);
	});

	await t.test('soft deletion removes credentials and tokens atomically', async () => {
		const account = await db.query.users.findFirst({
			where: eq(users.email, 'signup@example.test')
		});
		assert.ok(account);
		assert.equal((await softDeleteUserById(db, account.id)).ok, true);
		assert.ok((await db.query.users.findFirst({ where: eq(users.id, account.id) }))?.deletedAt);
		assert.equal(
			await db.query.authEmail.findFirst({ where: eq(authEmail.subjectId, account.id) }),
			undefined
		);
		assert.equal(
			await db.query.tokens.findFirst({ where: eq(tokens.userId, account.id) }),
			undefined
		);
	});
});
