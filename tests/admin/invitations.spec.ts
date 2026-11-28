import { execFileSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import {
	newApiContext,
	registerUser,
	syntheticIp,
	uniqueEmail,
	uniqueUsername
} from '../helpers/api';
import { adminUrl, apiUrl } from '../helpers/env';

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
	await expect(page.getByRole('button', { name: 'Use dark theme' }).first()).toBeEnabled();
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
		if (role === 'admin')
			await expect(row.getByRole('cell', { name: 'Pending invitation' })).toBeVisible();
		await expect((role === 'admin' ? users : admins).getByText(email, { exact: true })).toHaveCount(
			0
		);
	});
}

test('account overview returns to a valid page and keeps the admin section', async ({ page }) => {
	await page.goto('/?page=999999');
	await expect(page).toHaveURL(/\?page=\d+$/);
	expect(new URL(page.url()).searchParams.get('page')).not.toBe('999999');
	await expect(page.getByRole('table', { name: 'Regular users', exact: true })).toBeVisible();
	const admin = page
		.getByRole('table', { name: 'Admins', exact: true })
		.getByRole('row')
		.filter({ hasText: adminEmail });
	await expect(admin.getByRole('cell', { name: 'Verified', exact: true })).toBeVisible();
});

test('typed confirmation deletes a regular account and revokes its session', async ({
	page,
	playwright
}) => {
	const api = await newApiContext(playwright);
	try {
		const account = await registerUser(api);
		const me = await api.get('/auth/me');
		const { sub } = await me.json();
		await page.setViewportSize({ width: 375, height: 740 });
		await page.getByRole('button', { name: 'Use dark theme' }).first().click();
		await page.reload();
		const row = page.getByRole('row').filter({ hasText: account.email });
		await expect(row).toBeVisible();
		for (const confirmation of [undefined, 'delete']) {
			const response = await page.request.post(`${adminUrl}/?index`, {
				headers: { origin: adminUrl },
				form: {
					intent: 'delete-user',
					id: sub,
					...(confirmation === undefined ? {} : { confirmation })
				}
			});
			expect(response.status()).toBe(400);
		}
		expect((await api.get('/auth/me')).status()).toBe(200);
		await row.getByRole('button', { name: 'Delete user' }).click();
		const dialog = page.getByRole('dialog', { name: `Delete ${account.username}’s account?` });
		await expect(dialog).toBeVisible();
		const input = dialog.getByRole('textbox', { name: 'Type DELETE to confirm' });
		await expect(input).toBeFocused();
		await input.fill('DELETE');
		await dialog.getByRole('button', { name: 'Delete user' }).click();
		await expect(row).toHaveCount(0);
		await expect(page.getByRole('status').filter({ hasText: 'User deleted.' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeFocused();
		expect((await api.get('/auth/me')).status()).toBe(401);
		const audit = await page.request.get(`${apiUrl}/admin/audit-log`, {
			params: { action: 'user.delete', entityId: sub }
		});
		expect(audit.status()).toBe(200);
		expect((await audit.json()).entries).toEqual([
			expect.objectContaining({ action: 'user.delete', entityId: sub })
		]);
	} finally {
		await api.dispose();
	}
});

test('audit log shows invitations and filters by record', async ({ page }) => {
	await page.getByRole('button', { name: 'Invite', exact: true }).click();
	await page.getByLabel('Email', { exact: true }).fill(uniqueEmail());
	await page.getByLabel('Username', { exact: true }).fill(uniqueUsername());
	await page.getByRole('button', { name: 'Send email invite' }).click();
	await expect(page.getByRole('status')).toHaveText('Invitation sent.');
	const response = await page.goto('/audit-log?action=user.invite');
	expect(response?.headers()['cache-control']).toContain('no-store');
	await expect(page.getByRole('cell', { name: 'user.invite', exact: true }).first()).toBeVisible();
	await page.getByLabel('Record ID').fill('missing-record');
	await page.getByRole('button', { name: 'Filter' }).click();
	await expect(page.getByText('No audit entries found.')).toBeVisible();
	await page.goto('/audit-log?action=user.invite&page=999999');
	await expect(page).not.toHaveURL(/page=999999/);
});

test('can replace a pending invitation from the Users list', async ({ page }) => {
	await page.getByRole('button', { name: 'Invite', exact: true }).click();
	const email = uniqueEmail();
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Username', { exact: true }).fill(uniqueUsername());
	await page.getByRole('button', { name: 'Create and copy invite link' }).click();
	const url = page.getByLabel('One-time invite link');
	await expect(url).toHaveValue(/\/invite\?t=[a-f0-9]{48}$/);
	const previous = await url.inputValue();
	await page.keyboard.press('Escape');
	const row = page.getByRole('row').filter({ hasText: email });
	await expect(row.getByText('Pending invitation')).toBeVisible();
	await row.getByRole('button', { name: 'Replace invitation' }).click();
	await page.getByRole('button', { name: 'Create and copy replacement link' }).click();
	await expect(url).toHaveValue(/\/invite\?t=[a-f0-9]{48}$/);
	expect(await url.inputValue()).not.toBe(previous);
});

test('searches account sections and filters pending invitations', async ({ page }) => {
	await page.getByRole('button', { name: 'Invite', exact: true }).click();
	const email = uniqueEmail();
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Username', { exact: true }).fill(uniqueUsername());
	await page.getByRole('button', { name: 'Send email invite' }).click();
	await expect(page.getByRole('status')).toHaveText('Invitation sent.');
	await page.keyboard.press('Escape');
	await page.getByLabel('Search accounts').fill(email.toUpperCase());
	await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('pending');
	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
	await expect(page.getByText('No admins match.')).toBeVisible();
	await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await expect(page.getByText('No users match.')).toBeVisible();
});
