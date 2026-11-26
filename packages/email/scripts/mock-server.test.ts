import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

test(
	'mock inbox binds only to loopback and captures local mail',
	{ timeout: 10_000 },
	async (t) => {
		const previousPort = process.env.PORT;
		const previousHost = process.env.DEV_HOST;
		process.env.PORT = '0';
		delete process.env.DEV_HOST;
		t.after(() => {
			if (previousPort === undefined) delete process.env.PORT;
			else process.env.PORT = previousPort;
			if (previousHost === undefined) delete process.env.DEV_HOST;
			else process.env.DEV_HOST = previousHost;
		});
		const { server } = await import('./mock-server');
		t.after(
			() =>
				new Promise<void>((resolve, reject) =>
					server.close((error) => (error ? reject(error) : resolve()))
				)
		);
		if (!server.listening) await once(server, 'listening');
		const address = server.address();
		assert.ok(address && typeof address !== 'string');
		assert.equal(address.address, '127.0.0.1');
		const base = `http://127.0.0.1:${address.port}`;
		const email = {
			from: 'sender@example.test',
			to: 'reader@example.test',
			subject: 'Local test',
			html: '<p>Test message</p>'
		};
		const sent = await fetch(`${base}/send`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(email)
		});
		assert.equal(sent.status, 200);
		const messages = (await (await fetch(`${base}/emails/to/${email.to}`)).json()) as Array<
			typeof email
		>;
		assert.equal(messages.length, 1);
		assert.equal(messages[0].html, email.html);
	}
);
