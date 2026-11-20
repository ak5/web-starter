import { test, expect, type BrowserContext } from '@playwright/test';
import { newApiContext, registerUser } from '../helpers/api';
import { webUrl } from '../helpers/env';

test('local SQLite notes persist offline and sync across devices with account isolation', async ({
	browser,
	playwright
}) => {
	test.setTimeout(120_000);
	const api = await newApiContext(playwright);
	const other = await newApiContext(playwright);
	const contexts: BrowserContext[] = [];
	try {
		await registerUser(api);
		await registerUser(other);
		const me = await (await api.get('/auth/me')).json();
		const authenticated = async (source: typeof api) => {
			const ctx = await browser.newContext();
			contexts.push(ctx);
			const state = await source.storageState();
			await ctx.addCookies(state.cookies);
			return ctx;
		};
		const first = await authenticated(api);
		const second = await authenticated(api);
		const stranger = await authenticated(other);
		let a = await first.newPage();
		const b = await second.newPage();
		const c = await stranger.newPage();
		await a.goto(`${webUrl}/notes`);
		await b.goto(`${webUrl}/notes`);
		await expect(a.getByRole('button', { name: 'Add note' })).toBeEnabled({ timeout: 45_000 });
		await expect(b.getByRole('button', { name: 'Add note' })).toBeEnabled({ timeout: 45_000 });

		await first.setOffline(true);
		await a.getByRole('textbox', { name: 'Note text' }).fill('Draft');
		await a.getByRole('button', { name: 'Add note' }).click();
		await a.getByRole('button', { name: 'Edit', exact: true }).click();
		await a.getByRole('textbox', { name: 'Note text' }).fill('Written offline');
		await a.getByRole('button', { name: 'Save note', exact: true }).click();
		await expect(a.getByText('Written offline', { exact: true })).toBeVisible();
		await expect(a.getByRole('status').first()).toHaveText('2 changes waiting to sync');
		await expect(b.getByText('Written offline', { exact: true })).toHaveCount(0);

		// Close the editor while offline so the next page has to reopen the OPFS queue.
		await a.close();
		await first.setOffline(false);
		a = await first.newPage();
		await a.goto(`${webUrl}/notes`);
		await expect(a.getByText('Written offline', { exact: true })).toBeVisible({ timeout: 30_000 });
		await expect(a.getByText('No pending changes', { exact: true })).toBeVisible({
			timeout: 30_000
		});
		await expect(b.getByText('Written offline', { exact: true })).toBeVisible({ timeout: 30_000 });
		await a.reload();
		await expect(a.getByText('Written offline', { exact: true })).toBeVisible({ timeout: 30_000 });
		await b.getByRole('button', { name: 'Edit', exact: true }).click();
		await b.getByRole('textbox', { name: 'Note text' }).fill('Edited on device two');
		await b.getByRole('button', { name: 'Save note', exact: true }).click();
		await expect(a.getByText('Edited on device two', { exact: true })).toBeVisible({
			timeout: 30_000
		});
		await c.goto(`${webUrl}/notes`);
		await expect(c.getByRole('button', { name: 'Add note' })).toBeEnabled({ timeout: 30_000 });
		await expect(c.getByText('Edited on device two', { exact: true })).toHaveCount(0);
		const crossUser = await other.post(`/sync?storeId=notes-v1-${me.sub}&transport=http`, {
			data: {}
		});
		expect(crossUser.status()).toBe(401);
		const payload = await api.post(
			`/sync?storeId=notes-v1-${me.sub}&transport=http&payload=${encodeURIComponent(JSON.stringify({ authToken: 'must-not-be-used' }))}`,
			{ data: {} }
		);
		expect(payload.status()).toBe(400);
		const ws = await api.get(`/sync?storeId=notes-v1-${me.sub}&transport=ws`);
		expect(ws.status()).toBe(405);
		await b.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(a.getByText('Edited on device two', { exact: true })).toHaveCount(0, {
			timeout: 30_000
		});
		await a.getByRole('textbox', { name: 'Note text' }).fill('Private to account A');
		await a.getByRole('button', { name: 'Add note', exact: true }).click();
		await expect(a.getByText('Private to account A', { exact: true })).toBeVisible();
		await a.getByRole('button', { name: 'Sign out', exact: true }).click();
		await expect(a.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
		await first.addCookies((await other.storageState()).cookies);
		await a.goto(`${webUrl}/notes`);
		await expect(a.getByRole('button', { name: 'Add note', exact: true })).toBeEnabled();
		await expect(a.getByText('Private to account A', { exact: true })).toHaveCount(0);
	} finally {
		for (const ctx of contexts) await ctx.close();
		await api.dispose();
		await other.dispose();
	}
});
