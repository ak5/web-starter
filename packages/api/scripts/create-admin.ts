#!/usr/bin/env tsx
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../src/db';
import { adminUsers, authEmail } from '../src/db/schema';
import { hashPassword } from '../src/lib/password';
import { publicId } from '../src/lib/public-id';

const [email, username, password, ...flags] = process.argv.slice(2);
if (!email || !username || !password || flags.some((flag) => flag !== '--remote')) {
	throw new Error('usage: pnpm create:admin <email> <username> <password> [--remote]');
}
const remote = flags.includes('--remote');
let directory: string | undefined;
let configPath = resolve('wrangler.jsonc');
if (remote) {
	const id = process.env.D1_DATABASE_ID;
	if (!id || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id) || /^00000000-/.test(id)) {
		throw new Error('--remote requires the actual D1_DATABASE_ID and Wrangler authentication.');
	}
	mkdirSync('.wrangler', { recursive: true });
	directory = mkdtempSync('.wrangler/admin-');
	configPath = join(directory, 'wrangler.json');
	writeFileSync(
		configPath,
		JSON.stringify({
			name: 'admin-bootstrap',
			compatibility_date: '2025-03-19',
			d1_databases: [{ binding: 'DB', database_name: 'bootstrap', database_id: id, remote: true }]
		})
	);
}
const runtime = await getPlatformProxy<{ DB: D1Database }>({
	configPath,
	envFiles: [],
	remoteBindings: remote
});
try {
	const database = db(runtime.env.DB);
	const existing = await database.query.adminUsers.findFirst({
		where: and(eq(adminUsers.email, email), isNull(adminUsers.deletedAt))
	});
	const id = existing?.id ?? crypto.randomUUID().replaceAll('-', '').slice(0, 21);
	const pub = existing?.publicId ?? publicId('admin');
	const identity = await database.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'admin'), eq(authEmail.subjectId, id))
	});
	const passwordHashed = await hashPassword(password);
	await database.batch([
		database
			.insert(adminUsers)
			.values({ id, publicId: pub, email, username })
			.onConflictDoNothing({ target: adminUsers.id }),
		identity
			? database
					.update(authEmail)
					.set({ passwordHashed, verified: true })
					.where(eq(authEmail.id, identity.id))
			: database
					.insert(authEmail)
					.values({ subjectType: 'admin', subjectId: id, email, passwordHashed, verified: true })
	]);
	console.log(`publicId=${pub}`);
} finally {
	await runtime.dispose();
	if (directory) rmSync(directory, { recursive: true, force: true });
}
