import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { JwtPayload } from '@ak5/shared';
import type { Database } from '../../db';
import type { Env } from '../../types';
import { users } from '../../db/schema';
import { handleDiscordOAuthCallback } from './discord';

function provider(t: TestContext) {
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
			email: 'PRIVATE@example.test',
			verified: true
		});
	});
}

const env = {
	REGISTRATION_MODE: 'open',
	TOKEN_ENCRYPTION_KEY: 'ab'.repeat(32),
	PUBLIC_API_URL: 'https://api.example.test',
	EMAIL: {
		send: async () => {
			throw Error('must not send');
		}
	}
} as unknown as Env;

test('Discord signup gets a collision-resistant username and normalized verified email', async (t) => {
	provider(t);
	let created: Record<string, unknown> | undefined;
	const result = await handleDiscordOAuthCallback({
		db: {
			query: {
				users: { findFirst: async () => undefined },
				authDiscord: { findFirst: async () => undefined },
				authEmail: { findFirst: async () => undefined }
			},
			insert: (table: unknown) => ({
				values: async (row: Record<string, unknown>) => {
					if (table === users) {
						assert.notEqual(
							row.username,
							'tester',
							'tester is already taken by a password account'
						);
						created = row;
					}
				}
			}),
			batch: async (queries: Promise<unknown>[]) => Promise.all(queries)
		} as unknown as Database,
		env,
		auth: null,
		code: 'test-code'
	});
	assert.equal(result.kind, 'login');
	assert.ok(created);
	assert.match(String(created.username), /^tester_[a-z0-9]{10}$/);
	assert.equal(created.email, 'private@example.test');
	assert.equal(created.termsAcceptedAt, undefined);
	assert.equal(created.termsVersion, undefined);
	if (result.kind === 'login') assert.equal(result.jwtPayload.emailConfirmed, true);
});

for (const mode of ['expired', 'impersonated', 'recent'] as const) {
	test(`Discord linking handles ${mode} authentication without silently granting credentials`, async (t) => {
		provider(t);
		let writes = 0;
		const now = Math.floor(Date.now() / 1000);
		const auth = {
			sub: 'u-owner',
			type: 'user',
			recentAuthAt: mode === 'expired' ? now - 3600 : now,
			sessionVersion: 0,
			...(mode === 'impersonated' ? { impersonatedBy: 'a-support' } : {})
		} as JwtPayload;
		const result = await handleDiscordOAuthCallback({
			db: {
				query: {
					users: {
						findFirst: async () => ({ id: 'owner', publicId: 'u-owner', sessionVersion: 0 })
					},
					authDiscord: { findFirst: async () => undefined }
				},
				insert: () => ({
					values: async () => {
						writes++;
					}
				})
			} as unknown as Database,
			env,
			auth,
			code: 'test-code'
		});
		assert.equal(writes, mode === 'recent' ? 1 : 0);
		assert.deepEqual(
			result,
			mode === 'recent'
				? { kind: 'connect', redirectTo: '/account/password?connected=discord' }
				: {
						kind: 'redirect',
						redirectTo: `/account/password?error=${mode === 'expired' ? 'recent_auth_required' : 'forbidden'}`
					}
		);
	});
}

test('Discord signup rejects an email reserved by an active account without a login identity', async (t) => {
	provider(t);
	const result = await handleDiscordOAuthCallback({
		db: {
			query: {
				authDiscord: { findFirst: async () => undefined },
				users: { findFirst: async () => ({ id: 'invited' }) }
			},
			insert: () => {
				throw Error('must not merge or create another account');
			}
		} as unknown as Database,
		env,
		auth: null,
		code: 'test-code'
	});
	assert.deepEqual(result, {
		kind: 'redirect',
		redirectTo: '/login?error=email_already_registered'
	});
});

test('invite-only rejects a new Discord identity before writing an account', async (t) => {
	provider(t);
	const result = await handleDiscordOAuthCallback({
		db: {
			query: { authDiscord: { findFirst: async () => undefined } }
		} as unknown as Database,
		env: { ...env, REGISTRATION_MODE: undefined },
		auth: null,
		code: 'test-code'
	});
	assert.deepEqual(result, { kind: 'redirect', redirectTo: '/login?error=registration_closed' });
});
