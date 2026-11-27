import { test, expect } from '@playwright/test';
import { newApiContext, registerUser, syntheticIp } from '../helpers/api';
import { webUrl } from '../helpers/env';

test('SSR login and logout work with JavaScript disabled', async ({ browser, playwright }) => {
	const api = await newApiContext(playwright);
	const context = await browser.newContext({
		javaScriptEnabled: false,
		extraHTTPHeaders: { 'cf-connecting-ip': syntheticIp() }
	});
	try {
		const user = await registerUser(api);
		const page = await context.newPage();
		await page.goto(`${webUrl}/login?next=%2Fnotes`);
		await page.getByLabel('Email', { exact: true }).fill(user.email);
		await page.getByLabel('Password', { exact: true }).fill(user.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL(`${webUrl}/notes`);
		await expect(page.getByRole('heading', { name: 'Offline notes' })).toBeVisible();
		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(`${webUrl}/`);
		await page.goto(`${webUrl}/notes`);
		await expect(page).toHaveURL(`${webUrl}/login?next=%2Fnotes`);
	} finally {
		await context.close();
		await api.dispose();
	}
});

test('client navigation rechecks the session on protected routes', async ({
	page,
	context,
	playwright
}) => {
	const api = await newApiContext(playwright);
	try {
		await registerUser(api);
		await context.addCookies((await api.storageState()).cookies);
		await page.goto('/dashboard');
		await expect(page.getByRole('heading', { name: "You're signed in 🎉" })).toBeVisible();
		const darkTheme = page.getByRole('button', { name: 'Use dark theme' }).first();
		await expect(darkTheme).toBeEnabled();
		await context.clearCookies();
		const dataRequest = page.waitForResponse((response) =>
			/^\/notes(?:\/_)?\.data$/.test(new URL(response.url()).pathname)
		);
		await page.getByRole('link', { name: 'Offline notes', exact: true }).click();
		expect((await dataRequest).headers()['cache-control']).toBe('no-store');
		await expect(page).toHaveURL(`${webUrl}/login?next=%2Fnotes`);
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	} finally {
		await api.dispose();
	}
});

test('item form intents update the server list and clear a successful creation', async ({
	page,
	context,
	playwright
}) => {
	const api = await newApiContext(playwright);
	try {
		await registerUser(api);
		await context.addCookies((await api.storageState()).cookies);
		await page.goto('/items');
		const title = page.getByRole('textbox', { name: 'New item title' });
		await expect(page.getByRole('button', { name: 'Use dark theme' }).first()).toBeEnabled();
		await title.fill('Starter item');
		await page.getByRole('button', { name: 'Add item' }).click();
		const row = page.getByRole('row').filter({ hasText: 'Starter item' });
		await expect(row).toBeVisible();
		await expect(title).toHaveValue('');
		await row.getByRole('button', { name: 'Delete' }).click();
		await expect(row).toHaveCount(0);
	} finally {
		await api.dispose();
	}
});

test('explicit theme overrides the OS and survives reload at mobile width', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 720 });
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	const root = page.locator('html');
	await expect(root).toHaveCSS('color-scheme', 'light dark');
	await page.getByRole('button', { name: 'Use light theme' }).first().click();
	await expect(root).toHaveCSS('color-scheme', 'light');
	await page.reload();
	await expect(root).toHaveCSS('color-scheme', 'light');
	await page.getByRole('button', { name: 'Use dark theme' }).first().click();
	await expect(root).toHaveCSS('color-scheme', 'dark');
	await page.getByRole('button', { name: 'Use system theme' }).first().click();
	await expect(root).toHaveCSS('color-scheme', 'light dark');
});
