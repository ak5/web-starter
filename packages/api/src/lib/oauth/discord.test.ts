import assert from 'node:assert/strict';
import test from 'node:test';
import type { Database } from '../../db';
import type { Env } from '../../types';
import { handleDiscordOAuthCallback } from './discord';

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
			email: 'private@example.test',
			verified: true
		});
	});
	const result = await handleDiscordOAuthCallback({
		db: {
			query: {
				authDiscord: { findFirst: async () => undefined },
				authEmail: { findFirst: async () => undefined }
			},
			insert: () => ({ values: async () => {} }),
			batch: async (queries: Promise<unknown>[]) => Promise.all(queries)
		} as unknown as Database,
		env: {
			TOKEN_ENCRYPTION_KEY: 'ab'.repeat(32),
			PUBLIC_API_URL: 'https://api.example.test',
			EMAIL: {
				send: async () => {
					sent = true;
					throw Error('must not send');
				}
			}
		} as unknown as Env,
		auth: null,
		code: 'test-code',
		acceptedLegal: true
	});
	assert.equal(result.kind, 'login');
	if (result.kind === 'login') assert.equal(result.jwtPayload.emailConfirmed, true);
	assert.equal(sent, false);
});
