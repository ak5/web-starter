import assert from 'node:assert/strict';
import test from 'node:test';
import { apiLoadJson } from './form-actions';

test('list loads preserve upstream failures and reject malformed success bodies', async () => {
	await assert.rejects(
		apiLoadJson(Response.json({ error: 'outage' }, { status: 503 }), 'Load failed'),
		(error: unknown) => (error as { init: { status: number } }).init.status === 503
	);
	await assert.rejects(
		apiLoadJson(new Response('broken JSON'), 'Load failed'),
		(error: unknown) => (error as { init: { status: number } }).init.status === 502
	);
	assert.deepEqual(await apiLoadJson(Response.json({ items: [] }), 'Load failed'), { items: [] });
});
