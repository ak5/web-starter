import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';

/** A disposable, real local D1 binding; never connects to an account or live database. */
export async function createTestDatabase() {
	const runtime = await getPlatformProxy<{ DB: D1Database }>({
		configPath: fileURLToPath(new URL('../../wrangler.test.jsonc', import.meta.url)),
		persist: false,
		envFiles: [],
		remoteBindings: false
	});
	try {
		const binding = runtime.env.DB;
		const directory = fileURLToPath(new URL('../../drizzle/', import.meta.url));
		for (const file of readdirSync(directory)
			.filter((name) => name.endsWith('.sql'))
			.sort()) {
			const statements = readFileSync(`${directory}/${file}`, 'utf8')
				.split('--> statement-breakpoint')
				.map((statement) => statement.trim())
				.filter(Boolean);
			await binding.batch(statements.map((statement) => binding.prepare(statement)));
		}
		return { binding: binding as unknown as D1Database, dispose: () => runtime.dispose() };
	} catch (error) {
		await runtime.dispose();
		throw error;
	}
}
