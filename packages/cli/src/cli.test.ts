import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);

test('recovery command calls the selected public endpoint and reports HTTP failures', async () => {
	let status = 200;
	const requests: { path: string; body: unknown; cookie: string | undefined }[] = [];
	const server = createServer(async (req, res) => {
		let body = '';
		for await (const chunk of req) body += chunk;
		requests.push({ path: req.url!, body: JSON.parse(body), cookie: req.headers.cookie });
		res.writeHead(status, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(status === 200 ? { ok: true } : { error: 'rate_limited' }));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	try {
		const address = server.address();
		assert.ok(address && typeof address === 'object');
		const options = { env: { ...process.env, AK5_API_URL: `http://127.0.0.1:${address.port}` } };
		const args = ['--import', 'tsx', 'src/cli.ts', 'forgot-password', 'intended@example.test'];
		for (const extra of [[], ['--type', 'admin']]) {
			const result = await run(process.execPath, [...args, ...extra], options);
			assert.deepEqual(JSON.parse(result.stdout), { ok: true });
		}
		assert.deepEqual(
			requests.map((r) => r.path),
			['/auth/forgot-password', '/auth/admin/forgot-password']
		);
		for (const request of requests) {
			assert.deepEqual(request.body, { email: 'intended@example.test' });
			assert.equal(request.cookie, undefined);
		}
		status = 429;
		await assert.rejects(run(process.execPath, args, options), { code: 1 });
		await assert.rejects(run(process.execPath, args.slice(0, -1), options), { code: 2 });
	} finally {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
