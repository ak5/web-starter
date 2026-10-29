import { and, eq, isNull } from 'drizzle-orm';
import type { JwtPayload } from '@ak5/shared';

import { adminUsers, users } from '../db/schema';
import type { Database } from '../db';

/** An impersonation session loses access when the acting admin is removed. */
export async function isActiveImpersonator(db: Database, auth: JwtPayload): Promise<boolean> {
	if (!auth.impersonatedBy) return true;
	const admin = await db.query.adminUsers.findFirst({
		where: and(eq(adminUsers.publicId, auth.impersonatedBy), isNull(adminUsers.deletedAt)),
		columns: { sessionVersion: true }
	});
	return !!admin && admin.sessionVersion === (auth.impersonatorSessionVersion ?? 0);
}

export async function getActiveUserByAuth(db: Database, auth: JwtPayload) {
	if (auth.type !== 'user') return { error: 'forbidden' as const, status: 403 as const };

	const user = await db.query.users.findFirst({
		where: eq(users.publicId, auth.sub)
	});
	if (!user) return { error: 'not_found' as const, status: 404 as const };
	if (user.deletedAt || user.sessionVersion !== (auth.sessionVersion ?? 0))
		return { error: 'unauthorized' as const, status: 401 as const };
	if (user.bannedAt && !auth.impersonatedBy) {
		return { error: 'user_disabled' as const, status: 403 as const };
	}
	return { user };
}
