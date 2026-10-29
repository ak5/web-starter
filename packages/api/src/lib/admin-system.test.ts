import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../types';
import { adminCloudflareIntegration } from './admin-system';

const env = {
	CLOUDFLARE_API_TOKEN: 'test-only-token',
	CLOUDFLARE_ACCOUNT_ID: 'test-account'
} as Env;
const workers = { success: true, result: [] };
const analytics = { data: { viewer: { accounts: [{ workersInvocationsAdaptive: [] }] } } };

test('Cloudflare diagnostics distinguish empty results from failed requests', async (t) => {
	for (const [name, scripts, graphql, status] of [
		['HTTP rejection', workers, analytics, 403],
		['REST failure', { success: false, result: [] }, analytics, 200],
		['GraphQL error', workers, { ...analytics, errors: [{ message: 'Access denied' }] }, 200],
		['missing REST result', { success: true }, analytics, 200],
		['missing analytics', workers, { data: { viewer: { accounts: [] } } }, 200]
	] as const) {
		await t.test(name, async (t) => {
			t.mock.method(globalThis, 'fetch', async (url: string) =>
				Response.json(url.endsWith('/graphql') ? graphql : scripts, { status })
			);
			const result = await adminCloudflareIntegration(env);
			assert.equal(result.configured, true);
			assert.equal(result.available, false);
			assert.match(result.message ?? '', /Cloudflare/);
			assert.ok(!JSON.stringify(result).includes(env.CLOUDFLARE_API_TOKEN));
		});
	}
	await t.test('valid empty account', async (t) => {
		t.mock.method(globalThis, 'fetch', async (url: string) =>
			Response.json(url.endsWith('/graphql') ? analytics : workers)
		);
		const result = await adminCloudflareIntegration(env);
		assert.equal(result.available, true);
		assert.deepEqual(result.workers, []);
	});
});
