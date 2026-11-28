import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import { db as makeDb } from './index';
import { adminUsers, auditLog, authEmail, items, logs, tokens, users } from './schema';
import { createTestDatabase } from './testing';
import { listAllItems } from '../lib/items';
import { adminHealthReport } from '../lib/admin-health';
import { adminAuditLog } from '../lib/admin-audit-log';
import { adminLogList } from '../lib/admin-logs';
import { adminTokenDiagnostics } from '../lib/admin-token-diagnostics';
import { consumeToken, issueToken, sha256Hex } from '../lib/tokens';
import {
	acceptInvitePreAuth,
	registerUserPreAuth,
	loginUserPreAuth,
	loginAdminPreAuth
} from '../lib/auth-prelogin';
import {
	adminDeleteUser,
	adminInviteAccount,
	replaceAdminInvite,
	adminUserList
} from '../lib/admin-users';
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
		const createdAt = new Date('2100-01-01');
		await db.insert(items).values([
			{ publicId: 'i-same-a', userId: 'owner', createdAt },
			{ publicId: 'i-same-b', userId: 'owner', createdAt }
		]);
		const first = await listAllItems(db, 0, 0, 1);
		const second = await listAllItems(db, 1, 1, 1);
		assert.equal(first.items[0].owner, 'owner');
		assert.equal(first.items[0].id, 'i-same-b');
		assert.equal(second.items[0].id, 'i-same-a');
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
		REGISTRATION_MODE: 'open',
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
	await t.test('invite-only rejects public signup without creating a user', async () => {
		const email = 'blocked@example.test';
		const result = await registerUserPreAuth(
			db,
			{ ...env, REGISTRATION_MODE: undefined },
			{
				email,
				username: 'blocked',
				password: 'password1234'
			}
		);
		assert.deepEqual(result, { ok: false, status: 403, body: { error: 'registration_closed' } });
		assert.equal(await db.query.users.findFirst({ where: eq(users.email, email) }), undefined);
	});
	t.mock.method(console, 'error', () => {});
	await t.test(
		'password signup reports an email owned by an account without password auth',
		async () => {
			const result = await registerUserPreAuth(db, env, {
				email: 'owner@example.test',
				username: 'new_owner',
				password: 'password1234'
			});
			assert.deepEqual(result, { ok: false, status: 409, body: { error: 'email_taken' } });
		}
	);

	await t.test(
		'failed verification delivery leaves an unconfirmed account able to log in',
		async () => {
			const result = await registerUserPreAuth(db, env, {
				email: 'signup@example.test',
				username: 'signup',
				password: 'password1234'
			});
			assert.equal(result.ok, true);
			if (!result.ok) return;
			assert.equal(result.body.verificationEmailSent, false);
			assert.ok(result.setCookie);
			const registered = await db.query.users.findFirst({
				where: eq(users.publicId, result.body.publicId)
			});
			assert.ok(registered);
			assert.equal(registered.termsAcceptedAt, null);
			assert.equal(registered.termsVersion, null);
			assert.equal(registered.privacyVersion, null);
			assert.equal(registered.acceptableUseVersion, null);
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

	await t.test(
		'pending invitation survives provider failure and cleanup and can be replaced once',
		async () => {
			const email = 'replace@example.test';
			await adminInviteAccount(db, env, 'a-admin', { email, username: 'replaceable' });
			const account = await db.query.users.findFirst({
				where: eq(users.email, email)
			});
			assert.ok(account);
			await db.delete(tokens).where(eq(tokens.userId, account.id));
			const list = await adminUserList(db, 0, 0, 100);
			assert.equal(
				list.users.find((user) => user.publicId === account.publicId)?.pendingInvite,
				true
			);
			const getLink = async () => {
				const r = await replaceAdminInvite(db, env, 'a-admin', account.publicId, 'link');
				assert.ok(r.ok && 'inviteUrl' in r.result && r.result.inviteUrl);
				const token = new URL(r.result.inviteUrl).searchParams.get('t');
				assert.ok(token);
				return token;
			};
			const previous = await getLink();
			const token = await getLink();
			const password = 'password1234';
			assert.equal((await acceptInvitePreAuth(db, env, { token: previous, password })).ok, false);
			const attempts = await Promise.all([
				acceptInvitePreAuth(db, env, { token, password }),
				acceptInvitePreAuth(db, env, { token, password })
			]);
			assert.equal(attempts.filter((result) => result.ok).length, 1);
			assert.equal(
				(await replaceAdminInvite(db, env, 'a-admin', account.publicId, 'link')).ok,
				false
			);
		}
	);

	await t.test(
		'email invites require a sender and transport before creating an account',
		async () => {
			const input = { email: 'nosender@example.test', username: 'nosender' };
			for (const settings of [{ PUBLIC_EMAIL_FROM: undefined }, { EMAIL: undefined }]) {
				assert.deepEqual(await adminInviteAccount(db, { ...env, ...settings }, 'a-admin', input), {
					ok: false,
					error: 'invite_email_unavailable',
					status: 503
				});
			}
			assert.equal(
				await db.query.users.findFirst({ where: eq(users.email, input.email) }),
				undefined
			);
			assert.equal(
				await db.query.authEmail.findFirst({ where: eq(authEmail.email, input.email) }),
				undefined
			);
			assert.deepEqual(
				await adminInviteAccount(db, env, 'a-admin', { ...input, role: 'admin', delivery: 'link' }),
				{
					ok: false,
					error: 'invalid_invite_delivery',
					status: 400
				}
			);
		}
	);

	for (const delivery of ['email', 'link'] as const) {
		await t.test(
			`${delivery} invitations expire after seven days, work once and apply the correct verification state`,
			async () => {
				let html = '';
				const settings: Env =
					delivery === 'email'
						? {
								...env,
								EMAIL: {
									send: async (message) => {
										html = message.html;
										return { messageId: 'test-message' };
									}
								}
							}
						: { ...env, EMAIL: undefined, PUBLIC_EMAIL_FROM: undefined };
				const verified = delivery === 'email';
				for (const expired of [true, false]) {
					const username = `new_${delivery}_${expired ? 'expired' : 'active'}`;
					const email = username + '@example.test';
					const before = Date.now();
					const created = await adminInviteAccount(db, settings, 'a-admin', {
						email,
						username,
						delivery
					});
					assert.ok(created.ok);
					const token = verified
						? html.match(/\/invite\?t=([a-f0-9]+)/)?.[1]
						: 'inviteUrl' in created.result &&
							created.result.inviteUrl &&
							new URL(created.result.inviteUrl).searchParams.get('t');
					assert.ok(token);
					assert.equal('inviteUrl' in created.result, !verified);
					const hash = await sha256Hex(token);
					const stored = await db.query.tokens.findFirst({ where: eq(tokens.tokenHash, hash) });
					assert.ok(stored);
					const expiresIn = stored.expiresAt.getTime() - before;
					assert.ok(Math.abs(expiresIn - 7 * 86400_000) < 2000);
					if (expired)
						await db
							.update(tokens)
							.set({ expiresAt: new Date(Date.now() - 5000) })
							.where(eq(tokens.tokenHash, hash));
					const password = 'password1234';
					assert.equal((await acceptInvitePreAuth(db, env, { token, password })).ok, !expired);
					assert.equal((await acceptInvitePreAuth(db, env, { token, password })).ok, false);
					assert.equal((await loginUserPreAuth(db, env, { email, password })).ok, !expired);
					assert.equal(
						(await db.query.users.findFirst({ where: eq(users.email, email) }))?.emailVerified,
						verified && !expired
					);
					assert.equal(
						(await db.query.authEmail.findFirst({ where: eq(authEmail.email, email) }))?.verified,
						verified && !expired
					);
				}
			}
		);
	}

	await t.test(
		'an emailed admin invitation verifies the address and enables admin sign-in',
		async () => {
			const email = 'invitedadmin@example.test';
			const password = 'password1234';
			let html = '';
			const result = await adminInviteAccount(
				db,
				{
					...env,
					EMAIL: {
						send: async (message) => {
							html = message.html;
							return { messageId: 'admin-invite' };
						}
					}
				},
				'a-admin',
				{ email, username: 'invitedadmin', role: 'admin', delivery: 'email' }
			);
			assert.ok(result.ok);
			const token = html.match(/https:\/\/admin\.example\.test\/invite\?t=([a-f0-9]{48})/)?.[1];
			assert.ok(token);
			const accepted = await acceptInvitePreAuth(db, env, { token, password });
			assert.ok(accepted.ok && accepted.body.type === 'admin');
			assert.equal(
				(await db.query.adminUsers.findFirst({ where: eq(adminUsers.email, email) }))
					?.emailVerified,
				true
			);
			assert.equal((await loginAdminPreAuth(db, env, { email, password })).ok, true);
			assert.equal((await loginUserPreAuth(db, env, { email, password })).ok, false);
			assert.equal((await acceptInvitePreAuth(db, env, { token, password })).ok, false);
		}
	);

	await t.test('invalid admin log offsets fall back to the first page', async () => {
		for (const page of ['1e308', String(Number.MAX_SAFE_INTEGER)]) {
			assert.equal((await adminLogList(db, { page })).page, 0);
			assert.equal((await adminAuditLog(db, { page })).page, 0);
		}
	});

	await t.test(
		'admin diagnostic responses omit internal record IDs and token secrets',
		async () => {
			await db.insert(logs).values({
				id: 'internal-log-id',
				timestamp: new Date(),
				level: 'info',
				context: {},
				data: { message: 'test' }
			});
			const logList = await adminLogList(db, {});
			const audit = await adminAuditLog(db, {});
			const tokenInfo = await adminTokenDiagnostics(db, 'invite@example.test');
			assert.equal(logList.logs.length, 1);
			assert.ok(audit.entries.length > 0);
			assert.equal(tokenInfo.ok, true);
			if (!tokenInfo.ok) return;
			assert.ok(tokenInfo.diagnostics.tokens.length > 0);
			for (const row of [...logList.logs, ...audit.entries, ...tokenInfo.diagnostics.tokens]) {
				assert.ok(!('id' in row));
				assert.ok(!('tokenHash' in row));
				assert.ok(!('userId' in row));
				assert.ok(!('adminId' in row));
			}
			assert.equal(audit.entries[0].admin?.publicId, 'a-admin');
			assert.match(tokenInfo.diagnostics.identities[0].publicId ?? '', /^u-/);
		}
	);

	await t.test('failed deletion audit rolls back account and credential removal', async () => {
		await issueToken(
			db,
			{ userId: 'owner' },
			'verify_email',
			'delete-sentinel',
			new Date(Date.now() + 60000)
		);
		await local.binding
			.prepare(
				"CREATE TRIGGER reject_delete_audit BEFORE INSERT ON audit_log WHEN NEW.action = 'user.delete' BEGIN SELECT RAISE(ABORT, 'audit rejected'); END"
			)
			.run();
		try {
			await assert.rejects(adminDeleteUser(db, 'a-admin', 'u-owner'));
			assert.equal(
				(await db.query.users.findFirst({ where: eq(users.id, 'owner') }))?.deletedAt,
				null
			);
			assert.ok(await db.query.tokens.findFirst({ where: eq(tokens.userId, 'owner') }));
		} finally {
			await local.binding.prepare('DROP TRIGGER reject_delete_audit').run();
		}
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

test('D1 lists active accounts beyond the first admin users page', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const db = makeDb(local.binding);
	const createdAt = new Date(1000);
	await db.batch(
		Array.from({ length: 11 }, (_, chunk) =>
			db.insert(users).values(
				Array.from({ length: 10 }, (_, index) => {
					const name = `account-${String(chunk * 10 + index).padStart(3, '0')}`;
					return {
						id: name,
						publicId: `u-${name}`,
						username: name,
						createdAt,
						deletedAt: chunk === 0 && index === 0 ? createdAt : null
					};
				})
			)
		)
	);
	const first = await adminUserList(db, 0, 0, 100);
	const filtered = await adminUserList(db, 0, 0, 100, { q: 'U-ACCOUNT-009', status: 'active' });
	assert.deepEqual(
		filtered.users.map(({ username }) => username),
		['account-009']
	);
	assert.equal(filtered.pagination.total, 1);
	await db.update(users).set({ bannedAt: createdAt }).where(eq(users.id, 'account-009'));
	const banned = await adminUserList(db, 0, 0, 100, { status: 'banned' });
	assert.deepEqual(
		banned.users.map(({ username }) => username),
		['account-009']
	);
	await db.update(users).set({ bannedAt: null }).where(eq(users.id, 'account-009'));
	const second = await adminUserList(db, 1, 100, 100);
	assert.equal(first.users.length, 100);
	assert.equal(first.pagination.total, 109);
	assert.equal(first.pagination.hasNext, true);
	assert.deepEqual(
		second.users.map(({ username }) => username),
		Array.from({ length: 9 }, (_, index) => `account-00${9 - index}`)
	);
	assert.equal(second.pagination.hasNext, false);
});
