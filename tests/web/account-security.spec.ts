import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { newApiContext, registerUser, uniqueEmail, uniqueUsername } from '../helpers/api';
import { adminUrl, apiUrl, mockUrl, webUrl } from '../helpers/env';

for (const role of ['user', 'admin'] as const) {
	test(`${role} verifies and signs in with a new email address`, async ({
		page,
		context,
		playwright
	}) => {
		const api = await newApiContext(playwright);
		const other = await newApiContext(playwright);
		try {
			const login = role === 'admin' ? '/auth/admin/login' : '/auth/login';
			const seed = () => {
				expect(new URL(apiUrl).hostname).toMatch(/localhost$/);
				const email = uniqueEmail();
				const password = 'local-test-admin-password!';
				execFileSync(
					'nice',
					['-n', '10', 'pnpm', 'create:admin', email, uniqueUsername(), password],
					{ stdio: 'pipe' }
				);
				return { email, password };
			};
			const { email, password } = role === 'user' ? await registerUser(api) : seed();
			expect((await api.post(login, { data: { email, password } })).ok()).toBe(true);
			expect((await other.post(login, { data: { email, password } })).ok()).toBe(true);
			await context.addCookies((await api.storageState()).cookies);
			const account = role === 'admin' ? adminUrl + '/account/password' : webUrl + '/account';
			await page.goto(account);
			const newEmail = uniqueEmail();
			await page.getByLabel('New email', { exact: true }).fill(newEmail);
			await page.getByRole('button', { name: 'Send code' }).click();
			await expect(page.getByText('Check the new address for your code.')).toBeVisible();
			let code = '';
			await expect
				.poll(async () => {
					const response = await api.get(`${mockUrl}/emails/to/${encodeURIComponent(newEmail)}`);
					const messages = (await response.json()) as Array<{ html: string }>;
					code =
						messages
							.map(({ html }) => html.match(/<strong>([A-Z2-9]{6})<\/strong>/)?.[1])
							.find(Boolean) ?? '';
					return code;
				})
				.toMatch(/^[A-Z2-9]{6}$/);
			await page.getByLabel('Email change code').fill(code);
			await page.getByRole('button', { name: 'Confirm email change' }).click();
			await expect(page.getByText('Email updated.')).toBeVisible();
			await expect(page.getByText(`Current sign-in email: ${newEmail}`)).toBeVisible();
			expect((await other.get('/auth/me')).status()).toBe(401);
			expect((await other.post(login, { data: { email, password } })).status()).toBe(401);
			expect((await other.post(login, { data: { email: newEmail, password } })).ok()).toBe(true);
		} finally {
			await api.dispose();
			await other.dispose();
		}
	});
}
