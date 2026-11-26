import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { newApiContext, registerUser, uniqueEmail, uniqueUsername } from '../helpers/api';
import { adminUrl, apiUrl, webUrl } from '../helpers/env';

const enabled = process.env.AK5_MCP_LOCAL === '1';
const rpcHeaders = {
	Accept: 'application/json, text/event-stream',
	'Content-Type': 'application/json'
};

test('MCP is disabled by default on both portals', async ({ request }) => {
	test.skip(enabled);
	for (const origin of [webUrl, adminUrl]) {
		for (const route of ['/mcp', '/oauth/authorize', '/.well-known/oauth-authorization-server']) {
			expect((await request.get(origin + route)).status()).toBe(404);
		}
	}
});

let callbackServer: Server | undefined;
test.afterEach(() => {
	callbackServer?.closeAllConnections();
	callbackServer?.close();
	callbackServer = undefined;
});

for (const role of ['user', 'admin'] as const) {
	test(`${role} MCP consent, PKCE, refresh, and audience isolation`, async ({
		page,
		playwright,
		request
	}) => {
		test.skip(!enabled);
		const slot = readFileSync('.env.dev-slot', 'utf8');
		const web = 'http://127.0.0.1:' + /^AK5_WEB_PORT=(\d+)/m.exec(slot)?.[1];
		const admin = 'http://127.0.0.1:' + /^AK5_ADMIN_PORT=(\d+)/m.exec(slot)?.[1];
		const origin = role === 'admin' ? admin : web;
		const other = role === 'admin' ? web : admin;
		const credentials = { email: uniqueEmail(), password: 'password1234' };
		if (role === 'admin') {
			execFileSync('pnpm', [
				'--filter',
				'@ak5/api',
				'create:admin',
				credentials.email,
				uniqueUsername(),
				credentials.password
			]);
		} else {
			const api = await newApiContext(playwright);
			try {
				Object.assign(credentials, await registerUser(api));
			} finally {
				await api.dispose();
			}
		}
		const resource = origin + '/mcp';
		expect((await request.get(apiUrl + '/.well-known/oauth-authorization-server')).status()).toBe(
			404
		);
		callbackServer = createServer((_req, res) => res.end('Callback received'));
		callbackServer.listen(0, '127.0.0.1');
		await once(callbackServer, 'listening');
		const address = callbackServer.address();
		if (!address || typeof address === 'string') throw new Error('No callback address');
		const callback = `http://127.0.0.1:${address.port}/callback`;
		const challenge = await request.post(resource, { headers: rpcHeaders, data: {} });
		expect(challenge.status()).toBe(401);
		expect(challenge.headers()['www-authenticate']).toContain(origin);
		const metadata = await request.get(origin + '/.well-known/oauth-authorization-server');
		expect((await metadata.json()).issuer).toBe(origin);
		const registration = await request.post(origin + '/oauth/register', {
			data: {
				client_name: 'Local MCP test',
				redirect_uris: [callback],
				token_endpoint_auth_method: 'none'
			}
		});
		expect(registration.status()).toBe(201);
		const { client_id } = await registration.json();
		const verifier = randomBytes(32).toString('base64url');
		const query = new URLSearchParams({
			response_type: 'code',
			client_id,
			resource,
			redirect_uri: callback,
			scope: 'ak5-web',
			state: 'local-test',
			code_challenge: createHash('sha256').update(verifier).digest('base64url'),
			code_challenge_method: 'S256'
		});
		const noPkce = new URLSearchParams(query);
		noPkce.delete('code_challenge');
		noPkce.delete('code_challenge_method');
		expect(
			(await request.get(origin + '/oauth/authorize?' + noPkce, { maxRedirects: 0 })).status()
		).toBe(400);

		await page.goto(origin + '/oauth/authorize?' + query);
		await page.getByRole('link', { name: /Sign in as/ }).click();
		await page.getByLabel('Email', { exact: true }).fill(credentials.email);
		await page.getByLabel('Password', { exact: true }).fill(credentials.password);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Connect ak5-web' })).toBeVisible();
		await expect(page.getByText(credentials.email, { exact: true })).toBeVisible();
		if (role === 'admin') await page.getByRole('radio', { name: /Read and operate/ }).check();
		const approval = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				new URL(response.url()).pathname === '/oauth/authorize'
		);
		await page.getByRole('button', { name: 'Connect', exact: true }).click();
		const approved = await approval;
		expect(approved.status()).toBe(303);
		const redirect = new URL(approved.headers().location, origin);
		expect(redirect.origin + redirect.pathname).toBe(callback);
		await expect(page.getByText('Callback received')).toBeVisible();
		const code = new URL(page.url()).searchParams.get('code');
		expect(code).toBeTruthy();
		const token = (form: Record<string, string>, portal = origin) =>
			request.post(portal + '/oauth/token', { form: { client_id, ...form } });
		const exchange = {
			grant_type: 'authorization_code',
			code: code!,
			redirect_uri: callback,
			resource
		};
		expect((await token({ ...exchange, code_verifier: 'wrong' })).status()).toBe(400);
		const authorized = await token({ ...exchange, code_verifier: verifier });
		expect(authorized.status()).toBe(200);
		const grant = await authorized.json();
		const list = (portal: string, access: string) =>
			request.post(portal + '/mcp', {
				headers: { ...rpcHeaders, Authorization: 'Bearer ' + access },
				data: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
			});
		const tools = await list(origin, grant.access_token);
		expect(tools.status()).toBe(200);
		expect((await tools.json()).result.tools.map((tool: { name: string }) => tool.name)).toEqual(
			role === 'admin' ? ['get_system_health', 'set_my_display_name'] : ['list_items']
		);
		const operation = await request.post(resource, {
			headers: { ...rpcHeaders, Authorization: 'Bearer ' + grant.access_token },
			data: {
				jsonrpc: '2.0',
				id: 2,
				method: 'tools/call',
				params:
					role === 'admin'
						? { name: 'set_my_display_name', arguments: { displayName: 'Local MCP Admin' } }
						: { name: 'create_item', arguments: { title: 'This must be rejected' } }
			}
		});
		const outcome = await operation.json();
		if (role === 'admin') expect(JSON.parse(outcome.result.content[0].text).ok).toBe(true);
		else expect(!!outcome.error || outcome.result?.isError).toBe(true);

		expect((await list(other, grant.access_token)).status()).toBe(401);
		const refresh = { grant_type: 'refresh_token', refresh_token: grant.refresh_token, resource };
		expect((await token(refresh, other)).ok()).toBe(false);
		const refreshed = await token(refresh);
		expect(refreshed.status()).toBe(200);
		const replacement = await refreshed.json();
		expect(replacement.refresh_token).not.toBe(grant.refresh_token);
		await page.goto(origin + '/oauth/authorize?' + query);
		await expect(page.getByText(credentials.email, { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByText('Callback received')).toBeVisible();
		expect(new URL(page.url()).searchParams.get('error')).toBe('access_denied');
		if (role === 'admin') {
			execFileSync('pnpm', [
				'--filter',
				'@ak5/api',
				'create:admin',
				credentials.email,
				uniqueUsername(),
				'newpassword1234'
			]);
		} else {
			await page.goto(origin + '/account/password');
			await page.getByRole('button', { name: 'Disconnect MCP clients' }).click();
			await expect(page.getByText('MCP connections disconnected.')).toBeVisible();
		}
		expect((await list(origin, replacement.access_token)).status()).toBe(401);
		expect((await token({ ...refresh, refresh_token: replacement.refresh_token })).ok()).toBe(
			false
		);
		expect((await token({ ...exchange, code_verifier: verifier })).status()).toBe(400);
	});
}
