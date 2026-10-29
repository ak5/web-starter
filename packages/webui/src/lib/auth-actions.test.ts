import assert from 'node:assert/strict';
import test from 'node:test';
import type { Cookies } from '@sveltejs/kit';
import { accountPasswordAction } from './auth-actions.js';

test('password action forwards the replacement session cookie', async () => {
	const written: Array<[string, string]> = [];
	const result = await accountPasswordAction({
		locals: { auth: { hasPassword: true } },
		request: new Request('https://app.example.test/account/password', {
			method: 'POST',
			body: new URLSearchParams({ currentPassword: 'old', newPassword: 'new', password2: 'new' })
		}),
		cookies: {
			set: (name: string, value: string) => written.push([name, value])
		} as unknown as Cookies,
		changePassword: async () =>
			Response.json(
				{ ok: true },
				{ headers: { 'set-cookie': 'ak5_token=replacement; Path=/; HttpOnly' } }
			),
		acceptInvite: async () => {
			throw new Error('unexpected invite');
		},
		setPassword: async () => {
			throw new Error('unexpected first password');
		},
		failures: { changePassword: 'failed', acceptInvite: 'failed', setPassword: 'failed' }
	});
	assert.deepEqual(result, { ok: true });
	assert.deepEqual(written, [['ak5_token', 'replacement']]);
});
