import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('preflight exits after checking streamed pages', { timeout: 15000 }, async () => {
	const cwd = await mkdtemp(join(tmpdir(), 'starter-preflight-'));
	const server = createServer((request, response) => {
		response.writeHead(200);
		if (request.url === '/api/healthz') response.end('{"ok":true}');
		else response.write('streamed page');
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const base = `http://127.0.0.1:${server.address().port}`;
	const child = spawn(
		process.execPath,
		[
			'--import',
			import.meta.resolve('tsx'),
			fileURLToPath(new URL('./preflight.ts', import.meta.url))
		],
		{
			cwd,
			env: {
				...process.env,
				PUBLIC_API_URL: `${base}/api`,
				PUBLIC_WEB_URL: `${base}/web`,
				PUBLIC_ADMIN_URL: `${base}/admin`,
				AK5_MOCK_URL: `${base}/mock`,
				SKIP_PREFLIGHT: '0'
			},
			stdio: ['ignore', 'pipe', 'pipe']
		}
	);
	let output = '';
	child.stdout.on('data', (data) => {
		output += data;
	});
	child.stderr.on('data', (data) => {
		output += data;
	});
	const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
	try {
		const [code] = await once(child, 'exit');
		assert.equal(code, 0, output);
		assert.match(output, /all systems go/);
	} finally {
		clearTimeout(timer);
		child.kill();
		server.closeAllConnections();
		server.close();
		await rm(cwd, { recursive: true, force: true });
	}
});
