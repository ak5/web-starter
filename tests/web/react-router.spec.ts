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
		await page.goto('/items?page=1');
		await expect(page).toHaveURL(`${webUrl}/items?page=0`);
		const title = page.getByRole('textbox', { name: 'New item title' });
		await expect(page.getByRole('button', { name: 'Use dark theme' }).first()).toBeEnabled();
		await title.fill('Starter item');
		await page.getByRole('button', { name: 'Add item' }).click();
		const row = page.getByRole('row').filter({ hasText: 'Starter item' });
		await expect(row).toBeVisible();
		await expect(title).toHaveValue('');
		const trigger = row.getByRole('button', { name: 'Delete' });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: 'Delete Starter item?' });
		const confirmation = dialog.getByRole('textbox', { name: 'Type DELETE to confirm' });
		const confirm = dialog.getByRole('button', { name: 'Delete permanently' });
		await expect(confirmation).toBeFocused();
		await confirmation.fill('delete');
		await expect(confirm).toBeDisabled();
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await trigger.click();
		await expect(confirmation).toHaveValue('');
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
		await expect(row).toBeVisible();
		await trigger.click();
		const { items } = await (await api.get('/items')).json();
		const action = new URL('/items', webUrl).href;
		for (const confirmation of [undefined, 'delete']) {
			const response = await page.request.post(action, {
				headers: { origin: webUrl },
				form: {
					intent: 'delete',
					id: items[0].id,
					...(confirmation === undefined ? {} : { confirmation })
				}
			});
			expect(response.status()).toBe(400);
		}

		let attempts = 0;
		let releasePost!: () => void;
		const holdPost = new Promise<void>((resolve) => {
			releasePost = resolve;
		});
		await page.route(/\/items(?:\.data)?(?:\?|$)/, async (route) => {
			const request = route.request();
			if (request.method() !== 'POST') return route.fallback();
			attempts++;
			if (attempts === 1) {
				const fields = new URLSearchParams(request.postData() ?? '');
				fields.set('confirmation', 'delete');
				await route.fulfill({ response: await route.fetch({ postData: fields.toString() }) });
				return;
			}
			await holdPost;
			await route.continue();
		});
		await confirmation.fill('DELETE');
		await confirm.click();
		await expect(dialog.getByRole('alert')).toHaveText('Type DELETE to confirm.');
		await expect(row).toBeVisible();
		try {
			await dialog.locator('form').evaluate((form: HTMLFormElement) => {
				form.requestSubmit();
				form.requestSubmit();
			});
			await expect(dialog.getByRole('button', { name: 'Working…' })).toBeDisabled();
			await page.keyboard.press('Escape');
			await expect(dialog).toBeVisible();
		} finally {
			releasePost();
		}

		await expect(row).toHaveCount(0);
		await expect(
			page.getByRole('status', { name: '' }).filter({ hasText: 'Item deleted.' })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Your items' })).toBeFocused();
		expect(attempts).toBe(2);
		for (let index = 0; index < 51; index++) {
			const response = await api.post('/items', {
				data: { data: { title: `Page item ${index}` } }
			});
			expect(response.status()).toBe(201);
		}
		await page.reload();
		await page.getByRole('link', { name: 'Next page' }).click();
		await expect(page).toHaveURL(`${webUrl}/items?page=1`);
		const lastRow = page.getByRole('row').filter({ hasText: /Page item \d+/ });
		await expect(lastRow).toHaveCount(1);
		const lastTitle = (await lastRow.getByRole('cell').first().innerText()).trim();
		await lastRow.getByRole('button', { name: 'Delete', exact: true }).click();
		const lastDialog = page.getByRole('dialog', { name: `Delete ${lastTitle}?` });
		await lastDialog.getByRole('textbox', { name: 'Type DELETE to confirm' }).fill('DELETE');
		await lastDialog.getByRole('button', { name: 'Delete permanently' }).click();
		await expect(page).toHaveURL(`${webUrl}/items?page=0`);
		await expect(lastDialog).toBeHidden();
		await expect(page.getByRole('heading', { name: 'Your items' })).toBeFocused();
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
