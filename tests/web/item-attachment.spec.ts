import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { newApiContext, registerUser } from '../helpers/api';

test('uploads a private attachment and deletes it with its item', async ({
	page,
	context,
	playwright
}) => {
	const api = await newApiContext(playwright);
	try {
		await registerUser(api);
		await context.addCookies((await api.storageState()).cookies);
		await page.goto('/items');
		await page.getByLabel('New item title').fill('Private document');
		await page.getByRole('button', { name: 'Add item' }).click();
		const row = page.getByRole('row').filter({ hasText: 'Private document' });
		await expect(row).toBeVisible();
		const contents = '%PDF-1.7\nprivate fixture';
		await row.getByLabel('Attachment file').setInputFiles({
			name: 'document.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from(contents)
		});
		await row.getByRole('button', { name: 'Attach file' }).click();
		const link = row.getByRole('link', { name: 'Download document.pdf' });
		await expect(link).toBeVisible();
		const url = (await link.getAttribute('href'))!;
		const headers = await page.request.get(url);
		expect(headers.status()).toBe(200);
		expect(headers.headers()['cache-control']).toBe('private, no-store');
		const pending = page.waitForEvent('download');
		await link.click();
		const download = await pending;
		expect(download.suggestedFilename()).toBe('document.pdf');
		expect(await readFile((await download.path())!, 'utf8')).toBe(contents);
		await row.getByRole('button', { name: 'Delete', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Delete Private document?' });
		await expect(
			dialog.getByText('This permanently removes the item and its attachment.')
		).toBeVisible();
		await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
		await dialog.getByRole('button', { name: 'Delete permanently' }).click();
		await expect(row).toHaveCount(0);
		expect((await page.request.get(url)).status()).toBe(404);
	} finally {
		await api.dispose();
	}
});
