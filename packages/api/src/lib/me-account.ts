import { COOKIE_TOKEN, type JwtPayload } from '@ak5/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { Database } from '../db';
import { adminUsers, authDiscord, authEmail, users } from '../db/schema';
import type { Env } from '../types';
import { softDeleteUserById } from './account-deletion';
import { getActiveUserByAuth } from './auth-subject';
import { clearJwtCookie } from './jwt';
import { accountEmailSummary } from './me-display';
import type { ProfilePatch } from './me-validation';
import { uploadImage } from './upload';

export async function meAccount(db: Database, auth: JwtPayload) {
	if (auth.type === 'user') {
		const activeUser = await getActiveUserByAuth(db, auth);
		if ('error' in activeUser) {
			return { ok: false as const, error: activeUser.error, status: activeUser.status };
		}
		const row = activeUser.user;
		return {
			ok: true as const,
			account: {
				type: 'user' as const,
				publicId: row.publicId,
				username: row.username,
				displayName: row.displayName,
				email: row.email,
				emailVerified: row.emailVerified,
				emailSummary: accountEmailSummary(row.emailVerified),
				role: row.role,
				avatar: row.avatar,
				lastLoginAt: row.lastLoginAt,
				createdAt: row.createdAt
			}
		};
	}

	const row = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, auth.sub)
	});
	if (!row) return { ok: false as const, error: 'not_found' as const, status: 404 as const };

	return {
		ok: true as const,
		account: {
			type: 'admin' as const,
			publicId: row.publicId,
			username: row.username,
			displayName: row.displayName,
			email: row.email,
			emailVerified: row.emailVerified,
			emailSummary: accountEmailSummary(row.emailVerified),
			createdAt: row.createdAt
		}
	};
}

export async function meSecuritySummary(db: Database, auth: JwtPayload) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}
	const row = activeUser.user;

	const [emailIdentity, discordIdentity] = await Promise.all([
		db.query.authEmail.findFirst({
			where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, row.id))
		}),
		db.query.authDiscord.findFirst({
			where: and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.subjectId, row.id))
		})
	]);
	const emailVerified = emailIdentity?.verified ?? row.emailVerified;

	return {
		ok: true as const,
		security: {
			hasEmailAuth: !!emailIdentity,
			email: emailIdentity?.email ?? row.email ?? '',
			emailVerified,
			emailStatusLabel: emailVerified ? 'Verified' : 'Unverified',
			emailStatusBadgeClass: emailVerified ? 'badge-success' : 'badge-warning',
			hasDiscordAuth: !!discordIdentity,
			discordUsername: discordIdentity?.discordUsername ?? '',
			discordStatusLabel: discordIdentity ? 'Connected' : 'Not connected',
			discordStatusBadgeClass: discordIdentity ? 'badge-success' : 'badge-ghost'
		}
	};
}

export async function disconnectDiscordAuth(db: Database, auth: JwtPayload) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}
	const row = activeUser.user;

	const [emailIdentity, discordIdentity] = await Promise.all([
		db.query.authEmail.findFirst({
			where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, row.id))
		}),
		db.query.authDiscord.findFirst({
			where: and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.subjectId, row.id))
		})
	]);

	if (!discordIdentity) {
		return {
			ok: true as const,
			result: {
				ok: true,
				disconnected: false,
				successMessage: 'Discord account was already disconnected.'
			}
		};
	}
	if (!emailIdentity?.verified) {
		return {
			ok: false as const,
			error: 'verified_email_auth_required' as const,
			status: 409 as const
		};
	}

	await db
		.delete(authDiscord)
		.where(and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.subjectId, row.id)));

	return {
		ok: true as const,
		result: {
			ok: true,
			disconnected: true,
			successMessage: 'Discord account disconnected.'
		}
	};
}

export async function updateMeProfile(db: Database, auth: JwtPayload, patch: ProfilePatch) {
	if (auth.type === 'admin') {
		const set: Partial<typeof adminUsers.$inferInsert> = {};
		if (patch.displayName !== undefined) set.displayName = patch.displayName ?? null;
		if (Object.keys(set).length === 0) {
			return { ok: true as const, result: { ok: true, successMessage: 'Profile updated.' } };
		}
		await db.update(adminUsers).set(set).where(eq(adminUsers.publicId, auth.sub));
		return { ok: true as const, result: { ok: true, successMessage: 'Profile updated.' } };
	}

	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}
	const row = activeUser.user;

	if (patch.username && patch.username !== row.username) {
		const taken = await db.query.users.findFirst({
			where: and(eq(users.username, patch.username), isNull(users.deletedAt))
		});
		if (taken)
			return { ok: false as const, error: 'username_taken' as const, status: 409 as const };
	}

	const set: Partial<typeof users.$inferInsert> = {};
	if (patch.displayName !== undefined) set.displayName = patch.displayName ?? null;
	if (patch.avatar !== undefined) set.avatar = patch.avatar ?? null;
	if (patch.username !== undefined) set.username = patch.username;
	if (Object.keys(set).length === 0) {
		return { ok: true as const, result: { ok: true, successMessage: 'Profile updated.' } };
	}

	await db.update(users).set(set).where(eq(users.publicId, auth.sub));
	return { ok: true as const, result: { ok: true, successMessage: 'Profile updated.' } };
}

export async function uploadMeAvatar(
	db: Database,
	auth: JwtPayload,
	r2: R2Bucket,
	publicR2Url: string,
	file: File
) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}
	const row = activeUser.user;

	const result = await uploadImage(r2, publicR2Url, file, {
		prefix: `avatars/${row.publicId}`
	});
	if ('error' in result) return { ok: false as const, error: result.error, status: 400 as const };

	await db
		.update(users)
		.set({ avatar: result.url, avatarSource: 'upload' })
		.where(eq(users.id, row.id));

	return { ok: true as const, result: { url: result.url } };
}

export async function uploadMeAvatarWithInput(
	db: Database,
	auth: JwtPayload,
	r2: R2Bucket,
	publicR2Url: string,
	input: { imageUpload: File }
) {
	return uploadMeAvatar(db, auth, r2, publicR2Url, input.imageUpload);
}

export async function deleteMeAccount(db: Database, auth: JwtPayload) {
	const now = new Date();

	if (auth.type === 'user') {
		const activeUser = await getActiveUserByAuth(db, auth);
		if ('error' in activeUser) {
			return { ok: false as const, error: activeUser.error, status: activeUser.status };
		}
		const result = await softDeleteUserById(db, activeUser.user.id);
		if (!result.ok) return { ok: false as const, error: result.error, status: result.status };
		return { ok: true as const, result: { ok: true } };
	}

	const row = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, auth.sub)
	});
	if (!row) return { ok: false as const, error: 'not_found' as const, status: 404 as const };

	await db.transaction(async (tx) => {
		await tx.update(adminUsers).set({ deletedAt: now }).where(eq(adminUsers.id, row.id));
		await tx
			.delete(authEmail)
			.where(and(eq(authEmail.subjectType, 'admin'), eq(authEmail.subjectId, row.id)));
	});

	return { ok: true as const, result: { ok: true } };
}

export async function deleteMeAccountResponse(db: Database, env: Env, auth: JwtPayload) {
	const result = await deleteMeAccount(db, auth);
	if (!result.ok) {
		const status: ContentfulStatusCode = result.status ?? 500;
		return { ok: false as const, body: { error: result.error }, status };
	}

	return {
		ok: true as const,
		body: result.result,
		setCookie: clearJwtCookie(COOKIE_TOKEN, env.COOKIE_ORIGIN)
	};
}
