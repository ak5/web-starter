import { test, expect } from '@playwright/test';

test('admin shows the shared dismissible environment banner', async ({ page }) => {
	await page.goto('/login');
	const banner = page.getByRole('complementary', { name: 'Environment', exact: true });
	await expect(banner).toContainText('Development');
	await page.getByRole('button', { name: 'Dismiss environment banner' }).click();
	await expect(banner).toHaveCount(0);
	await page.reload();
	await expect(banner).toBeVisible();
});
