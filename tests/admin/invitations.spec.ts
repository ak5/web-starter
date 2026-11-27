import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { syntheticIp, uniqueEmail, uniqueUsername } from '../helpers/api';

const adminEmail = uniqueEmail();
const password = 'password1234';

test.beforeAll(() => {
	execFileSync('pnpm', [
		'--filter',
		'@ak5/api',
		'create:admin',
		adminEmail,
		uniqueUsername(),
		password
	]);
});

test.beforeEach(async ({ page }) => {
	await page.setExtraHTTPHeaders({ 'cf-connecting-ip': syntheticIp() });
	await page.goto('/login');
	await page.getByLabel('Email', { exact: true }).fill(adminEmail);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
});

for (const denied of [false, true]) {
	test(`copied invitation ${denied ? 'offers manual selection if clipboard access is denied' : 'writes to the clipboard automatically'}`, async ({
		page,
		context
	}) => {
		await context.addInitScript((deny) => {
			Object.defineProperty(navigator, 'clipboard', {
				value: {
					writeText: async (value: string) => {
						if (deny) throw new DOMException('Denied', 'NotAllowedError');
						document.documentElement.dataset.testClipboard = value;
					}
				}
			});
		}, denied);
		await page.reload();
		await page.getByRole('button', { name: 'Invite', exact: true }).click();
		await page.getByLabel('Email', { exact: true }).fill(uniqueEmail());
		await page.getByLabel('Username', { exact: true }).fill(uniqueUsername());
		const pending = page.waitForResponse((response) => response.request().method() === 'POST');
		await page.getByRole('button', { name: 'Create and copy invite link' }).click();
		expect((await pending).headers()['cache-control']).toContain('no-store');
		const url = page.getByLabel('One-time invite link');
		await expect(url).toHaveValue(/\/invite\?t=[a-f0-9]{48}$/);
		if (denied) {
			await page.getByRole('button', { name: 'Copy invite link', exact: true }).click();
			await expect(url).toBeFocused();
			expect(
				await url.evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)
			).toBe((await url.inputValue()).length);
		} else {
			await expect(page.getByRole('status')).toHaveText('Invite link copied.');
			await expect(page.locator('html')).toHaveAttribute(
				'data-test-clipboard',
				await url.inputValue()
			);
		}
	});
}

for (const role of ['user', 'admin']) {
	test(`admin can email an invitation for the ${role} role`, async ({ page }) => {
		await page.getByRole('button', { name: 'Invite', exact: true }).click();
		await page.getByLabel('Role', { exact: true }).selectOption(role);
		if (role === 'admin')
			await expect(
				page.getByRole('button', { name: 'Create and copy invite link' })
			).toBeDisabled();
		const email = uniqueEmail();
		await page.getByLabel('Email', { exact: true }).fill(email);
		await page.getByLabel('Username', { exact: true }).fill(uniqueUsername());
		await page.getByRole('button', { name: 'Send email invite' }).click();
		await expect(page.getByRole('status')).toHaveText('Invitation sent.');
		await expect(page.getByLabel('One-time invite link')).toHaveCount(0);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('button', { name: 'Invite', exact: true })).toBeFocused();
		const admins = page.getByRole('table', { name: 'Admins', exact: true });
		const users = page.getByRole('table', { name: 'Regular users', exact: true });
		const destination = role === 'admin' ? admins : users;
		const row = destination.getByRole('row').filter({ hasText: email });
		await expect(row).toBeVisible();
		if (role === 'admin') await expect(row.getByRole('cell', { name: 'Unverified' })).toBeVisible();
		await expect((role === 'admin' ? users : admins).getByText(email, { exact: true })).toHaveCount(
			0
		);
	});
}
