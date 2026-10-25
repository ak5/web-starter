import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailDeliveryError, getMockSendUrl, sendEmail, sendTemplate } from '../dist/index.js';

const config = { fromAddress: 'sender@example.test', fromName: 'Example app' };
const recipient = 'private@example.test';
const html = '<a href="secret-token">Private content</a>';

test('native binding receives native sender shape and rendered templates', async () => {
	let message: { from: unknown; to: string; subject: string; html: string } | undefined;
	assert.equal(
		await sendTemplate(
			{
				...config,
				email: {
					send: async (input) => {
						message = input;
						return { messageId: 'message-123' };
					}
				}
			},
			'VerifyEmail',
			recipient,
			{ pin: '123456', appUrl: 'https://example.test' }
		),
		true
	);
	assert.deepEqual(message?.from, { email: config.fromAddress, name: config.fromName });
	assert.equal(message?.to, recipient);
	assert.equal(message?.subject, 'Verify Email');
	assert.match(message?.html ?? '', /123456/);
	assert.match(message?.html ?? '', /https:\/\/example.test\/account\/verify/);
});

test('mock explicitly captures mail and never invokes the live binding', async (t) => {
	let request: { url: string; init?: RequestInit } | undefined;
	t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
		request = { url: String(url), init };
		return Response.json({ success: true });
	});
	assert.equal(
		await sendEmail(
			{
				...config,
				mockApiUrl: 'http://127.0.0.1:8355/',
				email: {
					send: async () => {
						throw Error('must not send');
					}
				}
			},
			recipient,
			'Private subject',
			html
		),
		true
	);
	assert.equal(request?.url, 'http://127.0.0.1:8355/send');
	assert.deepEqual(JSON.parse(String(request?.init?.body)), {
		from: config.fromAddress,
		from_name: config.fromName,
		to: recipient,
		subject: 'Private subject',
		html
	});
});

for (const body of ['{"success":false}', '{}', 'null', '{"success":"true"}', 'invalid JSON']) {
	test(`mock rejects unsuccessful capture: ${body}`, async (t) => {
		const events: string[] = [];
		t.mock.method(globalThis, 'fetch', async () => new Response(body));
		t.mock.method(console, 'error', (event: string) => events.push(event));
		await assert.rejects(
			sendEmail(
				{ ...config, mockApiUrl: 'http://localhost:8355' },
				recipient,
				'Private subject',
				html
			),
			EmailDeliveryError
		);
		assert.equal(events.length, 1);
		assert.equal(JSON.parse(events[0]).transport, 'mock');
		assert.doesNotMatch(events[0], /private|Private|secret-token/);
	});
}

for (const code of [
	'E_SENDER_NOT_VERIFIED',
	'E_RATE_LIMIT_EXCEEDED',
	'private@example.test',
	'email.sending.error.email.sending_disabled'
]) {
	test(`provider failures are redacted: ${code}`, async (t) => {
		const events: string[] = [];
		t.mock.method(console, 'error', (event: string) => events.push(event));
		await assert.rejects(
			sendEmail(
				{
					...config,
					email: {
						send: async () => {
							throw Object.assign(Error('private auth-link'), { code });
						}
					}
				},
				recipient,
				'Private subject',
				html
			),
			EmailDeliveryError
		);
		assert.deepEqual(JSON.parse(events[0]), {
			event: 'email.delivery_failed',
			transport: 'cloudflare',
			code: code.startsWith('E_') ? code : 'SEND_FAILED'
		});
		assert.doesNotMatch(events[0], /private|Private|auth-link|secret-token/);
	});
}

test('missing bindings and invalid message IDs fail closed', async (t) => {
	t.mock.method(console, 'error', () => {});
	await assert.rejects(sendEmail(config, recipient, 'Test', html), {
		code: 'MISSING_EMAIL_BINDING'
	});
	for (const messageId of ['', ' ']) {
		await assert.rejects(
			sendEmail(
				{ ...config, email: { send: async () => ({ messageId }) } },
				recipient,
				'Test',
				html
			),
			{ code: 'MISSING_MESSAGE_ID' }
		);
	}
});

test('mock HTTP and network failures are redacted with or without a logger', async (t) => {
	const events: unknown[] = [];
	const logger = {
		log: (_level: string, _message: string, data?: Record<string, unknown>) => events.push(data)
	};
	t.mock.method(globalThis, 'fetch', async () => new Response('private raw body', { status: 503 }));
	await assert.rejects(
		sendEmail(
			{ ...config, mockApiUrl: 'http://localhost:8355' },
			recipient,
			'Private subject',
			html,
			logger
		),
		{ code: 'HTTP_503' }
	);
	t.mock.method(globalThis, 'fetch', async () => {
		throw Error('private network response');
	});
	await assert.rejects(
		sendEmail(
			{ ...config, mockApiUrl: 'http://localhost:8355' },
			recipient,
			'Private subject',
			html,
			logger
		),
		{ code: 'SEND_FAILED' }
	);
	assert.equal(events.length, 2);
	assert.doesNotMatch(JSON.stringify(events), /private|Private|secret-token/);
});

test('mock URL validation accepts local HTTP and HTTPS only', () => {
	assert.equal(
		getMockSendUrl('http://localhost:8355/base/?secret=x'),
		'http://localhost:8355/base/send'
	);
	assert.equal(getMockSendUrl('https://example.test'), 'https://example.test/send');
	for (const url of [undefined, 'invalid', 'http://example.test', 'file:///private'])
		assert.equal(getMockSendUrl(url), null);
});
