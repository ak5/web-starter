import { test, expect } from '@playwright/test';

test('admin login page renders', async ({ page }) => {
	const res = await page.goto('/login');
	expect(res?.ok()).toBeTruthy();
	await expect(page.locator('input[type="password"]')).toBeVisible();
});
