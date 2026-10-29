import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);

test('recovery command calls the selected public endpoint and reports HTTP failures', async (t) => {
	const directory = mkdtempSync(join(tmpdir(), 'starter-cli-recovery-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
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
		const options = {
			env: {
				...process.env,
				XDG_CONFIG_HOME: directory,
				AK5_API_URL: `http://127.0.0.1:${address.port}`
			}
		};
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

test('persona credentials stay private and command failures cannot look successful', async (t) => {
	const directory = mkdtempSync(join(tmpdir(), 'starter-cli-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const requests: string[] = [];
	let status = 200;
	const server = createServer((req, res) => {
		requests.push(req.url!);
		res.writeHead(status, {
			'Content-Type': 'application/json',
			...(req.url === '/auth/login'
				? { 'Set-Cookie': 'ak5_token=test-only-session; HttpOnly' }
				: {})
		});
		res.end(JSON.stringify(status === 200 ? { ok: true } : { error: 'unauthorized' }));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(async () => {
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
	});
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	const options = {
		env: {
			...process.env,
			XDG_CONFIG_HOME: directory,
			AK5_API_URL: `http://127.0.0.1:${address.port}`
		}
	};
	const cli = (...args: string[]) =>
		run(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], options);
	await cli('login', 'test@example.test', 'test-password');
	const path = join(directory, 'ak5-cli/identities.json');
	assert.equal(statSync(path).mode & 0o777, 0o600);
	chmodSync(path, 0o644);
	await cli('login', 'test@example.test', 'test-password');
	assert.equal(
		statSync(path).mode & 0o777,
		0o600,
		'updates tighten permissions on an existing store'
	);
	const listing = await cli('list-identities');
	assert.ok(!listing.stdout.includes('test-only-session'));
	status = 401;
	await assert.rejects(cli('whoami'), { code: 1 });
	await assert.rejects(cli('admin', 'users'), { code: 1 });
	const count = requests.length;
	await assert.rejects(cli('--prod', 'whoami'), { code: 1 });
	assert.equal(requests.length, count, 'missing production identity must not fall back to dev');
	writeFileSync(path, '{"identities": private-session');
	await assert.rejects(cli('logout'), (error: unknown) => {
		const failure = error as { code: number; stderr: string };
		assert.equal(failure.code, 1);
		assert.ok(!failure.stderr.includes('private-session'));
		return true;
	});
	assert.equal(
		readFileSync(path, 'utf8'),
		'{"identities": private-session',
		'preserve unreadable credentials for recovery'
	);
});
