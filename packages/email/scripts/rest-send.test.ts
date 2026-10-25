import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailDeliveryError } from '../dist/index.js';
import { sendRestTestEmail } from './rest-send.js';

const config = {
	accountId: 'a'.repeat(32),
	apiToken: 'private-token',
	from: 'sender@example.test',
	fromName: 'Example app',
	to: 'private@example.test',
	subject: 'Private subject',
	html: '<p>private</p>'
};
for (const status of ['delivered', 'queued'] as const) {
	test(`REST diagnostic reports ${status} with REST sender shape`, async (t) => {
		t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
			assert.equal(
				String(url),
				`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`
			);
			assert.deepEqual(JSON.parse(String(init?.body)).from, {
				address: config.from,
				name: config.fromName
			});
			return Response.json({ success: true, result: { [status]: [config.to] } });
		});
		assert.equal(await sendRestTestEmail(config), status);
	});
}
for (const response of [
	new Response('private raw provider failure', { status: 403 }),
	Response.json({ success: false }),
	Response.json({ success: true, result: { permanent_bounces: [config.to] } }),
	Response.json({ success: true }),
	new Response('invalid JSON')
]) {
	test('REST failures never log provider content or recipients', async (t) => {
		const events: string[] = [];
		t.mock.method(console, 'error', (event: string) => events.push(event));
		t.mock.method(globalThis, 'fetch', async () => response.clone());
		await assert.rejects(sendRestTestEmail(config), EmailDeliveryError);
		assert.equal(events.length, 1);
		assert.doesNotMatch(events[0], /private|Private/);
	});
}
