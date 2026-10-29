import { test, expect } from '@playwright/test';
import { uniqueEmail, uniqueUsername, syntheticIp } from '../helpers/api';

test('website signup shows provider errors and creates a session without asserting policy agreement', async ({
	page
}) => {
	const ip = syntheticIp();
	await page.setExtraHTTPHeaders({ 'cf-connecting-ip': ip, 'x-forwarded-for': ip });
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/register?error=verified_discord_email_required');
	await expect(page.getByRole('alert')).toHaveText(
		'Verify your email in Discord before signing up.'
	);
	await page.getByLabel('Username').fill(uniqueUsername());
	await page.getByLabel('Email', { exact: true }).fill(uniqueEmail());
	await page.getByLabel('Password', { exact: true }).fill('password1234');
	await expect(page.getByRole('checkbox')).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL(/\/account\/verify$/);
	await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
	await page.screenshot({ path: 'tmp/starter-audit/signup-phone.png', fullPage: true });
});
