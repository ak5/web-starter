#!/usr/bin/env tsx
/**
 * Wipe the test database to empty, then re-apply Drizzle migrations.
 *
 * Usage:
 *   DATABASE_URL_TEST=postgres://... pnpm --filter @ak5/api db:reset:test
 *
 * Idempotent and safe to run any number of times. The wipe step uses
 * `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` so every table,
 * sequence, type, and function is removed in one shot — no need to chase
 * dependency order.
 *
 * Reads the URL from `DATABASE_URL_TEST` (preferred) or `DATABASE_URL` as a
 * fallback. The fallback exists for CI environments where only one URL is
 * exported. Refuses to run unless the URL clearly identifies the test branch
 * — set `ALLOW_NONTEST_RESET=1` to override (use with care).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from '@neondatabase/serverless';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..');
const drizzleDir = join(apiRoot, 'drizzle');

const databaseUrlTest = process.env.DATABASE_URL_TEST?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const url = databaseUrlTest || databaseUrl;
if (!url) {
	console.error('Either DATABASE_URL_TEST or DATABASE_URL must be set.');
	process.exit(2);
}

if (
	databaseUrlTest &&
	databaseUrl &&
	databaseUrlTest === databaseUrl &&
	!process.env.ALLOW_NONTEST_RESET
) {
	console.error(
		'DATABASE_URL_TEST matches DATABASE_URL. Refusing to wipe the dev database.\n' +
			'Create a dedicated Neon test branch or set ALLOW_NONTEST_RESET=1 if you really mean it.'
	);
	process.exit(3);
}

const looksLikeTest = /test|playwright|ci|local/i.test(url);
if (!looksLikeTest && !process.env.ALLOW_NONTEST_RESET) {
	console.error(
		'Refusing to wipe a database whose URL does not contain test/playwright/ci/local.\n' +
			'Set ALLOW_NONTEST_RESET=1 if you really mean it (this will DROP every table).'
	);
	process.exit(3);
}

async function main() {
	const pool = new Pool({ connectionString: url });
	const client = await pool.connect();
	try {
		console.log('==> Wiping public schema');
		await client.query('DROP SCHEMA IF EXISTS public CASCADE');
		await client.query('CREATE SCHEMA public');
		await client.query('GRANT ALL ON SCHEMA public TO public');

		console.log('==> Re-applying migrations from packages/api/drizzle');
		const files = readdirSync(drizzleDir)
			.filter((f) => f.endsWith('.sql'))
			.sort();
		for (const file of files) {
			const sql = readFileSync(join(drizzleDir, file), 'utf8');
			// Drizzle migrations contain --> statement-breakpoint markers separating
			// statements; split on those (and on bare semicolons for older files).
			const statements = sql
				.split(/--> statement-breakpoint|;\s*\n/)
				.map((s) => s.trim())
				.filter((s) => s.length > 0 && !s.startsWith('--'));
			for (const stmt of statements) {
				await client.query(stmt).catch((err: Error) => {
					// Repeat-safe: ignore "already exists" so we can re-run on a partially populated branch.
					if (/already exists/i.test(err.message)) return;
					throw new Error(`while running ${file}: ${err.message}\n${stmt.slice(0, 200)}`);
				});
			}
			console.log(`    applied ${file}`);
		}
		console.log('==> Done. Database is empty + migrated.');
	} finally {
		client.release();
		await pool.end();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
