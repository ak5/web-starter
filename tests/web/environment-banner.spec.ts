import { test, expect } from '@playwright/test';

test('environment banner dismissal resets on client navigation and reload', async ({ page }) => {
	await page.goto('/login');
	const banner = page.getByRole('complementary', { name: 'Environment', exact: true });
	await expect(banner).toContainText('Development');
	await page.getByRole('button', { name: 'Dismiss environment banner' }).click();
	await expect(banner).toHaveCount(0);
	// This link uses SvelteKit navigation, which retains the root layout.
	await page.getByRole('link', { name: 'ak5-web', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(banner).toBeVisible();
	await page.getByRole('button', { name: 'Dismiss environment banner' }).click();
	await page.reload();
	await expect(banner).toBeVisible();
});
