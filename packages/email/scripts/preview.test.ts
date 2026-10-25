import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('local Vite preview lists and renders templates without accepting arbitrary template paths', async (t) => {
	const root = fileURLToPath(new URL('../', import.meta.url));
	const server = await createServer({
		root,
		configFile: `${root}/vite.config.ts`,
		logLevel: 'error',
		server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false },
		optimizeDeps: { noDiscovery: true }
	});
	t.after(() => server.close());
	await server.listen();
	const address = server.httpServer!.address();
	assert.ok(address && typeof address !== 'string');
	assert.equal(address.address, '127.0.0.1');
	const url = `http://127.0.0.1:${address.port}`;
	const index = await (await fetch(url)).text();
	for (const name of ['verify-email', 'reset-password', 'login-with', 'invite-account']) {
		assert.ok(index.includes(`href="/${name}"`));
		const response = await fetch(`${url}/${name}`);
		assert.equal(response.status, 200);
		assert.match(response.headers.get('content-type') ?? '', /text\/html/);
		assert.match(await response.text(), /ak5-web/);
	}
	const verify = await (await fetch(`${url}/verify-email`)).text();
	assert.match(verify, /0t0k3n/);
	assert.equal((await fetch(`${url}/not-a-template`)).status, 404);
	assert.equal((await fetch(`${url}/..%2Fstyles`)).status, 404);
});
