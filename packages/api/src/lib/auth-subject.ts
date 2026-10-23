import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import type { JwtPayload } from '@ak5/shared';

import { adminUsers, users } from '../db/schema';
import type { Database } from '../db';
import type { AppContext } from '../types';

type ApiContext = Context<AppContext>;

export async function getActiveUserByAuth(db: Database, auth: JwtPayload) {
	if (auth.type !== 'user') return { error: 'forbidden' as const, status: 403 as const };

	const user = await db.query.users.findFirst({
		where: eq(users.publicId, auth.sub)
	});
	if (!user) return { error: 'not_found' as const, status: 404 as const };
	if (user.deletedAt) return { error: 'unauthorized' as const, status: 401 as const };
	if (user.bannedAt && !auth.impersonatedBy) {
		return { error: 'user_disabled' as const, status: 403 as const };
	}
	return { user };
}

export async function getActiveUser(c: ApiContext, auth: JwtPayload) {
	return getActiveUserByAuth(c.var.db, auth);
}

export async function getActiveAuthSubject(c: ApiContext, auth: JwtPayload) {
	if (auth.type === 'user') {
		const user = await c.var.db.query.users.findFirst({
			where: eq(users.publicId, auth.sub),
			columns: { id: true, deletedAt: true, bannedAt: true }
		});
		if (!user || user.deletedAt) return { error: 'unauthorized' as const, status: 401 as const };
		if (user.bannedAt && !auth.impersonatedBy) {
			return { error: 'user_disabled' as const, status: 403 as const };
		}
		return { subjectType: 'user' as const, subjectId: user.id };
	}

	const admin = await c.var.db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, auth.sub),
		columns: { id: true, deletedAt: true }
	});
	if (!admin || admin.deletedAt) return { error: 'unauthorized' as const, status: 401 as const };
	return { subjectType: 'admin' as const, subjectId: admin.id };
}
