import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import type { JwtPayload } from '@ak5/shared';

import { authDiscord, authEmail, users } from '../../db/schema';
import type { AppContext } from '../../types';

type ApiContext = Context<AppContext>;

export async function getActiveAttachUser(c: ApiContext, auth: JwtPayload | null) {
	if (!auth || auth.type !== 'user') return null;
	const row = await c.var.db.query.users.findFirst({
		where: eq(users.publicId, auth.sub),
		columns: { id: true, deletedAt: true, bannedAt: true }
	});
	if (!row || row.deletedAt || row.bannedAt) return null;
	return row;
}

export async function getActiveOAuthUser(c: ApiContext, auth: JwtPayload | null) {
	if (!auth || auth.type !== 'user') return null;
	const row = await c.var.db.query.users.findFirst({
		where: eq(users.publicId, auth.sub),
		columns: {
			id: true,
			publicId: true,
			username: true,
			email: true,
			emailVerified: true,
			deletedAt: true,
			bannedAt: true
		}
	});
	if (!row || row.deletedAt || row.bannedAt) return null;
	return row;
}

export async function userHasPassword(c: ApiContext, userId: string) {
	const emailIdentity = await c.var.db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, userId)),
		columns: { id: true }
	});
	return Boolean(emailIdentity);
}

export async function isDiscordEmailAlreadyUsed(c: ApiContext, email: string) {
	const [emailIdentity, discordIdentity] = await Promise.all([
		c.var.db.query.authEmail.findFirst({
			where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.email, email)),
			columns: { id: true }
		}),
		c.var.db.query.authDiscord.findFirst({
			where: and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.discordEmail, email)),
			columns: { id: true }
		})
	]);
	return Boolean(emailIdentity || discordIdentity);
}
