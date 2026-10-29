import { execFileSync } from 'node:child_process';
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
	newApiContext,
	registerUser,
	syntheticIp,
	uniqueEmail,
	uniqueUsername
} from '../helpers/api';
import { apiUrl, webUrl, adminUrl, mockUrl } from '../helpers/env';

let administrator: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
	// This fixture uses the local bootstrap CLI; never point it at a hosted API.
	expect(
		new URL(apiUrl).hostname.endsWith('.localhost') || new URL(apiUrl).hostname === 'localhost'
	).toBe(true);
	const email = uniqueEmail();
	const username = uniqueUsername();
	const password = 'local-test-admin-123!';
	const seed = () =>
		execFileSync('nice', ['-n', '10', 'pnpm', 'create:admin', email, username, password], {
			stdio: 'pipe'
		});
	seed();
	administrator = await newApiContext(playwright);
	expect(
		(await administrator.post('/auth/admin/login', { data: { email, password } })).status()
	).toBe(200);
	seed();
	expect((await administrator.get('/auth/me')).status()).toBe(401);
	expect(
		(await administrator.post('/auth/admin/login', { data: { email, password } })).status()
	).toBe(200);
});

test.afterAll(async () => administrator?.dispose());

async function emailLink(api: APIRequestContext, email: string, path: string) {
	let url = '';
	await expect
		.poll(async () => {
			const response = await api.get(`${mockUrl}/emails/to/${encodeURIComponent(email)}`);
			const messages = (await response.json()) as Array<{ html: string }>;
			for (const message of messages) {
				const links = [...message.html.matchAll(/href="([^"]+)"/g)].map((match) =>
					match[1].replaceAll('&amp;', '&')
				);
				url = links.find((link) => new URL(link, webUrl).pathname.startsWith(path)) ?? '';
				if (url) break;
			}
			return url;
		})
		.not.toBe('');
	return url;
}

for (const role of ['user', 'admin'] as const) {
	const baseUrl = role === 'user' ? webUrl : adminUrl;
	const home = role === 'user' ? '/dashboard' : '/';
	const login = role === 'user' ? '/auth/login' : '/auth/admin/login';

	test(`${role}: email reset link works signed out, rejects reuse, and password change keeps the caller signed in`, async ({
		page,
		context,
		playwright
	}) => {
		await context.setExtraHTTPHeaders({ 'cf-connecting-ip': syntheticIp() });
		const oldSession = await newApiContext(playwright);
		try {
			let user;
			if (role === 'user') user = await registerUser(oldSession);
			else {
				user = {
					email: uniqueEmail(),
					username: uniqueUsername(),
					password: 'initial-password-123!'
				};
				expect(
					(await administrator.post('/admin/users', { data: { ...user, role } })).status()
				).toBe(201);
				expect((await oldSession.post(login, { data: user })).status()).toBe(200);
			}
			await page.goto(`${baseUrl}/login`);
			await page.getByRole('link', { name: 'Forgot password?' }).click();
			await page.getByLabel('Email', { exact: true }).fill(user.email);
			await page.getByRole('button', { name: 'Send reset link' }).click();
			await expect(page.getByRole('status').filter({ hasText: 'reset link' })).toBeVisible();
			const link = await emailLink(oldSession, user.email, '/account/password');
			expect((await page.goto(link))?.status()).toBe(200);
			await page.getByLabel('New password', { exact: true }).fill('new-password-456!');
			await page.getByLabel('Confirm new password').fill('different-password-456!');
			await page.getByRole('button', { name: 'Save password' }).click();
			await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
			await page.getByLabel('New password', { exact: true }).fill('new-password-456!');
			await page.getByLabel('Confirm new password').fill('new-password-456!');
			await page.getByRole('button', { name: 'Save password' }).click();
			await expect(page).toHaveURL(`${baseUrl}${home}`);
			expect((await oldSession.get('/auth/me')).status()).toBe(401);
			await page.goto(`${baseUrl}/account/password`);
			await page.getByLabel('Current password').fill('new-password-456!');
			await page.getByLabel('New password', { exact: true }).fill('changed-password-789!');
			await page.getByLabel('Confirm new password').fill('changed-password-789!');
			await page.getByRole('button', { name: 'Save password' }).click();
			await expect(page.getByRole('status').filter({ hasText: 'Password updated.' })).toBeVisible();
			await page.reload();
			await expect(page.getByLabel('Current password')).toBeVisible();
			await page.goto(link);
			await page.getByLabel('New password', { exact: true }).fill('another-password-123!');
			await page.getByLabel('Confirm new password').fill('another-password-123!');
			await page.getByRole('button', { name: 'Save password' }).click();
			await expect(page.getByRole('alert')).toContainText('That link has expired');
		} finally {
			await oldSession.dispose();
		}
	});

	test(`${role}: invitation and explicit reauthentication follow their captured email links`, async ({
		page,
		context
	}) => {
		await context.setExtraHTTPHeaders({ 'cf-connecting-ip': syntheticIp() });
		const email = uniqueEmail();
		expect(
			(
				await administrator.post('/admin/invite', {
					data: { email, username: uniqueUsername(), role }
				})
			).status()
		).toBe(201);
		const invitation = await emailLink(administrator, email, '/invite');
		await page.goto(invitation);
		await expect(page.getByRole('heading', { name: 'Set your new password' })).toBeVisible();
		await page.getByLabel('New password', { exact: true }).fill('invited-password-123!');
		await page.getByLabel('Confirm new password').fill('invited-password-123!');
		await page.getByRole('button', { name: 'Save password' }).click();
		await expect(page).toHaveURL(`${baseUrl}${home}`);
		expect((await page.request.post(`${apiUrl}/auth/request-reauth`)).status()).toBe(200);
		const magic = await emailLink(administrator, email, '/auth/magic/');
		await page.goto(magic);
		await page.reload(); // Visiting a link must not consume its token.
		await page.getByRole('button', { name: 'Confirm and continue' }).click();
		await expect(page).toHaveURL(`${baseUrl}/account/password?reauth=ok`);
		await expect(page.getByRole('status').filter({ hasText: 'Identity confirmed.' })).toBeVisible();
		await page.goto(magic);
		await page.getByRole('button', { name: 'Confirm and continue' }).click();
		await expect(page).toHaveURL(`${baseUrl}/account/password?reauth=failed`);
		await page.getByRole('button', { name: 'Email a confirmation link' }).click();
		await expect(page.getByRole('status').filter({ hasText: 'Check your email' })).toBeVisible();
	});
}
