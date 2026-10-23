import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db';
import { apiKeys, authDiscord, authEmail, sessions, tokens, users } from '../db/schema';

export type SoftDeleteUserResult =
	{ ok: true; publicId: string; id: string } | { ok: false; status: 404; error: 'user_not_found' };

export async function softDeleteUserByPublicId(db: Database, userPublicId: string) {
	const row = await db.query.users.findFirst({
		where: and(eq(users.publicId, userPublicId), isNull(users.deletedAt)),
		columns: { id: true, publicId: true }
	});
	if (!row) return { ok: false as const, status: 404 as const, error: 'user_not_found' as const };
	return softDeleteUserRow(db, row);
}

export async function softDeleteUserById(db: Database, userId: string) {
	const row = await db.query.users.findFirst({
		where: and(eq(users.id, userId), isNull(users.deletedAt)),
		columns: { id: true, publicId: true }
	});
	if (!row) return { ok: false as const, status: 404 as const, error: 'user_not_found' as const };
	return softDeleteUserRow(db, row);
}

async function softDeleteUserRow(
	db: Database,
	row: { id: string; publicId: string }
): Promise<SoftDeleteUserResult> {
	const now = new Date();
	await db.batch([
		db.update(users).set({ deletedAt: now }).where(eq(users.id, row.id)),
		db.delete(tokens).where(eq(tokens.userId, row.id)),
		db
			.delete(authEmail)
			.where(and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, row.id))),
		db
			.delete(authDiscord)
			.where(and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.subjectId, row.id))),
		db.delete(apiKeys).where(eq(apiKeys.userId, row.id)),
		db.delete(sessions).where(eq(sessions.userId, row.id))
	]);
	return { ok: true as const, publicId: row.publicId, id: row.id };
}
