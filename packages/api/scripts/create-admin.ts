#!/usr/bin/env tsx
/**
 * Create an admin user directly in Postgres. Used by tests (via
 * e2e/helpers.ts) and by operators bootstrapping the first admin in a
 * fresh environment.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm --filter @ak5/api create:admin <email> <username> <password>
 *
 * Prints `publicId=a-<id>` on success so callers can scrape it.
 *
 * Idempotent on email: if an admin with this email exists, updates the
 * password instead of failing. This lets tests re-run without manual cleanup
 * even when test DB reset is skipped.
 */
import { Pool } from '@neondatabase/serverless';
import { hashPassword } from 'worker-password-auth';
import { customAlphabet } from 'nanoid';

const [, , email, username, password] = process.argv;
if (!email || !username || !password) {
	console.error('usage: create-admin.ts <email> <username> <password>');
	process.exit(2);
}

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is required');
	process.exit(2);
}

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);
const publicNano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

async function main() {
	const pool = new Pool({ connectionString: url });
	const client = await pool.connect();

	try {
		const pwHash = await hashPassword(password);
		await client.query('BEGIN');

		const existing = await client.query<{ id: string; public_id: string }>(
			'SELECT id, public_id FROM admin_users WHERE email = $1 AND deleted_at IS NULL',
			[email]
		);

		let adminId: string;
		let publicId: string;
		if (existing.rows.length > 0) {
			adminId = existing.rows[0].id;
			publicId = existing.rows[0].public_id;
		} else {
			adminId = nano();
			publicId = `a-${publicNano()}`;
			await client.query(
				`INSERT INTO admin_users (id, public_id, email, username, email_verified)
				 VALUES ($1, $2, $3, $4, true)`,
				[adminId, publicId, email, username]
			);
		}

		// Upsert the auth_email row so password changes are honored.
		const auth = await client.query(
			`SELECT id FROM auth_email WHERE subject_type = 'admin' AND subject_id = $1`,
			[adminId]
		);
		if (auth.rows.length > 0) {
			await client.query(
				`UPDATE auth_email SET password_hashed = $1, verified = true WHERE id = $2`,
				[pwHash, auth.rows[0].id]
			);
		} else {
			await client.query(
				`INSERT INTO auth_email (id, subject_type, subject_id, email, password_hashed, verified)
				 VALUES ($1, 'admin', $2, $3, $4, true)`,
				[nano(), adminId, email, pwHash]
			);
		}

		await client.query('COMMIT');
		console.log(`publicId=${publicId}`);
	} catch (e) {
		await client.query('ROLLBACK').catch(() => {});
		throw e;
	} finally {
		client.release();
		await pool.end();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
