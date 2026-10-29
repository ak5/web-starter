import assert from 'node:assert/strict';
import test from 'node:test';
import type { Cookies } from '@sveltejs/kit';
import { accountPasswordAction, forgotPasswordAction } from './auth-actions.js';
import { apiErrorMessage } from './api-error.js';

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

test('recovery failures preserve HTTP status and show a useful message', async () => {
	const result = await forgotPasswordAction({
		request: new Request('https://app.example.test/forgot-password', {
			method: 'POST',
			body: new URLSearchParams({ email: 'owner@example.test' })
		}),
		forgotPassword: async () => Response.json({ error: 'rate_limited' }, { status: 429 })
	});
	assert.equal('status' in result && result.status, 429);
	assert.match('data' in result ? result.data.error : '', /Too many attempts/);
	assert.equal(
		await apiErrorMessage(Response.json({ error: 'invalid_token' }), 'Failed'),
		'That link has expired. Please request a new one.'
	);
	assert.equal(
		await apiErrorMessage(Response.json({ error: 'unknown_code' }), 'Please try again.'),
		'Please try again.'
	);
});
