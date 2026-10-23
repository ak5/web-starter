import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db';
import { users } from '../db/schema';

/**
 * Public profile read by username. No auth required. Returns display fields
 * only — never internal IDs or private columns. Extend with your own public
 * domain data as needed.
 */
export async function publicUserProfileResponse(db: Database, username: string) {
	const row = await db.query.users.findFirst({
		where: and(eq(users.username, username), isNull(users.deletedAt)),
		columns: {
			publicId: true,
			username: true,
			displayName: true,
			avatar: true,
			createdAt: true
		}
	});
	if (!row) {
		return { ok: false as const, status: 404 as const, body: { error: 'user_not_found' } };
	}
	return {
		ok: true as const,
		body: {
			user: {
				publicId: row.publicId,
				username: row.username,
				displayName: row.displayName,
				avatar: row.avatar,
				createdAt: row.createdAt
			}
		}
	};
}
