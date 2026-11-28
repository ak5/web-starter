import { test, expect } from '@playwright/test';
import { newApiContext, registerUser } from '../helpers/api';

test('updates a profile and deletes an account after typed confirmation', async ({
	page,
	context,
	playwright
}) => {
	const api = await newApiContext(playwright);
	try {
		await registerUser(api);
		await context.addCookies((await api.storageState()).cookies);
		const response = await page.goto('/account');
		expect(response?.headers()['cache-control']).toContain('no-store');
		await page.getByLabel('Display name').fill('My new display name');
		await page.getByRole('button', { name: 'Save profile' }).click();
		await expect(page.getByRole('status')).toHaveText('Profile updated.');
		await page.reload();
		await expect(page.getByLabel('Display name')).toHaveValue('My new display name');
		await page.getByLabel('Avatar image').setInputFiles({
			name: 'avatar.webp',
			mimeType: 'image/webp',
			buffer: Buffer.from(
				'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==',
				'base64'
			)
		});
		await page.getByRole('button', { name: 'Upload avatar' }).click();
		await expect(page.getByRole('status')).toHaveText('Avatar updated.');
		await expect(page.locator('img[src*="/avatars/"]')).toBeVisible();
		await page.getByRole('button', { name: 'Delete account', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
		const button = dialog.getByRole('button', { name: 'Delete account' });
		await expect(button).toBeDisabled();
		await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
		await button.click();
		await expect(page).toHaveURL(/\/$/);
		await page.goto('/account');
		await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
	} finally {
		await api.dispose();
	}
});
