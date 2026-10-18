import { and, desc, eq, isNull } from 'drizzle-orm';
import { COOKIE_ADMIN_TOKEN, COOKIE_TOKEN, jwtCookie, parseCookie } from '@ak5/shared';
import { EmailDeliveryError, sendTemplate } from '@ak5/email';
import type { Database } from '../db';
import { adminUsers, auditLog, authEmail, tokens, users } from '../db/schema';
import { emailConfig } from '../middleware/email-config';
import type { Env } from '../types';
import { softDeleteUserByPublicId } from './account-deletion';
import { displayDate, withPath } from './admin-display';
import { IMPERSONATION_SECONDS, impersonationJwtClaims } from './impersonation';
import { signJwt, verifyJwt } from './jwt';
import { hashPassword } from './password';
import { publicId } from './public-id';
import { generateMagicToken, sha256Hex } from './tokens';

type AdminInviteInput = {
	email: string;
	username: string;
	role?: 'user' | 'admin';
	roleRaw?: string;
};

type AdminCreateUserInput = {
	email: string;
	password: string;
	username: string;
	role: 'user' | 'admin';
};

type AdminActor = {
	id: string;
	publicId: string;
	username: string;
};

type AdminAuthSubject = {
	type: string;
	sub: string;
};

export async function adminUserList(db: Database) {
	const rows = await db.query.users.findMany({
		where: isNull(users.deletedAt),
		orderBy: [desc(users.createdAt)],
		limit: 100
	});

	return {
		users: rows.map((user) => ({
			publicId: user.publicId,
			username: user.username,
			email: user.email,
			role: user.role,
			emailVerified: user.emailVerified,
			statusLabel: user.bannedAt ? 'Banned' : 'Active',
			statusBadgeClass: user.bannedAt ? 'badge-error' : 'badge-success',
			canBan: !user.bannedAt,
			canUnban: !!user.bannedAt,
			canDelete: true,
			canImpersonate: true,
			bannedAt: user.bannedAt,
			createdLabel: displayDate(user.createdAt),
			createdAt: user.createdAt
		}))
	};
}

export async function adminInviteAccount(
	db: Database,
	env: Env,
	adminPublicId: string,
	data: AdminInviteInput
) {
	const { email, username, role: requestedRole, roleRaw } = data;
	const role = requestedRole ?? (roleRaw?.trim() === 'admin' ? 'admin' : 'user');
	const admin = await adminActor(db, adminPublicId);
	if (!admin)
		return { ok: false as const, error: 'admin_not_found' as const, status: 404 as const };

	const existingEmail = await db.query.authEmail.findFirst({
		where: eq(authEmail.email, email)
	});
	if (existingEmail)
		return { ok: false as const, error: 'email_taken' as const, status: 409 as const };

	const tempPassword = generateMagicToken();
	const token = generateMagicToken();
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	if (role === 'user') {
		const existingUsername = await db.query.users.findFirst({
			where: and(eq(users.username, username), isNull(users.deletedAt))
		});
		if (existingUsername) {
			return { ok: false as const, error: 'username_taken' as const, status: 409 as const };
		}

		const userId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
		const userPub = publicId('user');
		await db.transaction(async (tx) => {
			await tx.insert(users).values({
				id: userId,
				publicId: userPub,
				username,
				email,
				emailVerified: false,
				role: 'user'
			});
			await tx.insert(authEmail).values({
				subjectType: 'user',
				subjectId: userId,
				email,
				passwordHashed: await hashPassword(tempPassword),
				verified: false
			});
			await tx.insert(tokens).values({
				userId,
				adminId: null,
				purpose: 'reset_password',
				tokenHash: await sha256Hex(token),
				expiresAt,
				payload: { purpose: 'invite_user' }
			});
			await tx.insert(auditLog).values({
				adminId: admin.id,
				action: 'user.invite',
				entityType: 'user',
				entityId: userPub,
				payload: { email, username, adminPublicId: admin.publicId }
			});
		});
		if (!(await sendAdminInviteEmail(env, { email, role, token }))) {
			return {
				ok: false as const,
				error: 'invitation_delivery_failed' as const,
				status: 503 as const
			};
		}
		return { ok: true as const, result: { ok: true, publicId: userPub, role } };
	}

	const existingUsername = await db.query.adminUsers.findFirst({
		where: and(eq(adminUsers.username, username), isNull(adminUsers.deletedAt))
	});
	if (existingUsername) {
		return { ok: false as const, error: 'username_taken' as const, status: 409 as const };
	}

	const adminId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
	const adminPub = publicId('admin');
	await db.transaction(async (tx) => {
		await tx.insert(adminUsers).values({
			id: adminId,
			publicId: adminPub,
			username,
			email,
			emailVerified: false
		});
		await tx.insert(authEmail).values({
			subjectType: 'admin',
			subjectId: adminId,
			email,
			passwordHashed: await hashPassword(tempPassword),
			verified: false
		});
		await tx.insert(tokens).values({
			userId: null,
			adminId,
			purpose: 'reset_password',
			tokenHash: await sha256Hex(token),
			expiresAt,
			payload: { purpose: 'invite_admin' }
		});
		await tx.insert(auditLog).values({
			adminId: admin.id,
			action: 'admin_user.invite',
			entityType: 'admin_user',
			entityId: adminPub,
			payload: { email, username, adminPublicId: admin.publicId }
		});
	});
	if (!(await sendAdminInviteEmail(env, { email, role, token }))) {
		return {
			ok: false as const,
			error: 'invitation_delivery_failed' as const,
			status: 503 as const
		};
	}
	return { ok: true as const, result: { ok: true, publicId: adminPub, role } };
}

async function sendAdminInviteEmail(
	env: Env,
	invite: { email: string; role: 'user' | 'admin'; token: string }
) {
	const appUrl = invite.role === 'admin' ? env.PUBLIC_ADMIN_URL : env.PUBLIC_APP_URL;
	try {
		await sendTemplate(emailConfig(env), 'InviteAccount', invite.email, {
			inviteUrl: `${appUrl.replace(/\/$/, '')}/invite?t=${invite.token}`,
			role: invite.role,
			appUrl
		});
		return true;
	} catch (error) {
		if (!(error instanceof EmailDeliveryError)) throw error;
		return false;
	}
}

export async function adminCreateAccount(db: Database, data: AdminCreateUserInput) {
	const { email, password, username, role } = data;

	const existingEmail = await db.query.authEmail.findFirst({
		where: eq(authEmail.email, email)
	});
	if (existingEmail)
		return { ok: false as const, error: 'email_taken' as const, status: 409 as const };

	if (role === 'user') {
		const existingUsername = await db.query.users.findFirst({
			where: and(eq(users.username, username), isNull(users.deletedAt))
		});
		if (existingUsername) {
			return { ok: false as const, error: 'username_taken' as const, status: 409 as const };
		}

		const userId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
		const userPub = publicId('user');
		await db.transaction(async (tx) => {
			await tx.insert(users).values({
				id: userId,
				publicId: userPub,
				username,
				email,
				emailVerified: true,
				role: 'user'
			});
			await tx.insert(authEmail).values({
				subjectType: 'user',
				subjectId: userId,
				email,
				passwordHashed: await hashPassword(password),
				verified: true
			});
		});
		return { ok: true as const, result: { ok: true, publicId: userPub, role } };
	}

	const existingUsername = await db.query.adminUsers.findFirst({
		where: and(eq(adminUsers.username, username), isNull(adminUsers.deletedAt))
	});
	if (existingUsername) {
		return { ok: false as const, error: 'username_taken' as const, status: 409 as const };
	}

	const adminId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
	const adminPub = publicId('admin');
	await db.transaction(async (tx) => {
		await tx.insert(adminUsers).values({
			id: adminId,
			publicId: adminPub,
			username,
			email,
			emailVerified: true
		});
		await tx.insert(authEmail).values({
			subjectType: 'admin',
			subjectId: adminId,
			email,
			passwordHashed: await hashPassword(password),
			verified: true
		});
	});
	return { ok: true as const, result: { ok: true, publicId: adminPub, role } };
}

export async function adminDeleteUser(db: Database, adminPublicId: string, targetPublicId: string) {
	const admin = await adminActor(db, adminPublicId);
	if (!admin)
		return { ok: false as const, error: 'admin_not_found' as const, status: 404 as const };

	const result = await softDeleteUserByPublicId(db, targetPublicId);
	if (!result.ok) return { ok: false as const, error: result.error, status: result.status };

	await db.insert(auditLog).values({
		adminId: admin.id,
		action: 'user.delete',
		entityType: 'user',
		entityId: result.publicId,
		payload: { userPublicId: result.publicId, adminPublicId: admin.publicId }
	});

	return {
		ok: true as const,
		result: {
			ok: true,
			publicId: result.publicId,
			action: 'deleted',
			successMessage: 'User deleted.'
		}
	};
}

export async function adminBanUser(db: Database, adminPublicId: string, targetPublicId: string) {
	const [admin, target] = await adminActionSubjects(db, adminPublicId, targetPublicId);
	if (!admin)
		return { ok: false as const, error: 'admin_not_found' as const, status: 404 as const };
	if (!target)
		return { ok: false as const, error: 'user_not_found' as const, status: 404 as const };

	const bannedAt = new Date();
	await db.transaction(async (tx) => {
		await tx.update(users).set({ bannedAt }).where(eq(users.id, target.id));
		await tx.insert(auditLog).values({
			adminId: admin.id,
			action: 'user.ban',
			entityType: 'user',
			entityId: target.publicId,
			payload: { userPublicId: target.publicId, adminPublicId: admin.publicId }
		});
	});

	return {
		ok: true as const,
		result: {
			ok: true,
			publicId: target.publicId,
			action: 'banned',
			bannedAt,
			successMessage: 'User banned.'
		}
	};
}

export async function adminUnbanUser(db: Database, adminPublicId: string, targetPublicId: string) {
	const [admin, target] = await adminActionSubjects(db, adminPublicId, targetPublicId);
	if (!admin)
		return { ok: false as const, error: 'admin_not_found' as const, status: 404 as const };
	if (!target)
		return { ok: false as const, error: 'user_not_found' as const, status: 404 as const };

	await db.transaction(async (tx) => {
		await tx.update(users).set({ bannedAt: null }).where(eq(users.id, target.id));
		await tx.insert(auditLog).values({
			adminId: admin.id,
			action: 'user.unban',
			entityType: 'user',
			entityId: target.publicId,
			payload: { userPublicId: target.publicId, adminPublicId: admin.publicId }
		});
	});

	return {
		ok: true as const,
		result: {
			ok: true,
			publicId: target.publicId,
			action: 'unbanned',
			bannedAt: null,
			successMessage: 'User unbanned.'
		}
	};
}

export async function adminStartImpersonation(
	db: Database,
	input: {
		adminPublicId: string;
		targetPublicId: string;
		adminToken: string | null;
		jwtSecret: string;
		publicAppUrl: string;
	}
) {
	if (!input.adminToken) {
		return { ok: false as const, error: 'missing_admin_token' as const, status: 400 as const };
	}

	const adminPayload = await verifyJwt(input.jwtSecret, input.adminToken);
	if (!adminPayload || adminPayload.type !== 'admin' || adminPayload.sub !== input.adminPublicId) {
		return { ok: false as const, error: 'invalid_admin_token' as const, status: 403 as const };
	}

	const [admin, target] = await Promise.all([
		db.query.adminUsers.findFirst({
			where: eq(adminUsers.publicId, input.adminPublicId),
			columns: { id: true, publicId: true }
		}),
		db.query.users.findFirst({
			where: and(eq(users.publicId, input.targetPublicId), isNull(users.deletedAt)),
			columns: {
				id: true,
				publicId: true,
				username: true,
				email: true,
				emailVerified: true
			}
		})
	]);
	if (!admin)
		return { ok: false as const, error: 'admin_not_found' as const, status: 404 as const };
	if (!target)
		return { ok: false as const, error: 'user_not_found' as const, status: 404 as const };

	const emailIdentity = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, target.id)),
		columns: { email: true }
	});
	const impersonationToken = await signJwt(
		input.jwtSecret,
		impersonationJwtClaims(target, admin.publicId, emailIdentity?.email),
		IMPERSONATION_SECONDS
	);

	await db.insert(auditLog).values({
		adminId: admin.id,
		action: 'user.impersonate.start',
		entityType: 'user',
		entityId: target.publicId,
		payload: { userPublicId: target.publicId, adminPublicId: admin.publicId }
	});

	return {
		ok: true as const,
		result: {
			ok: true,
			publicId: target.publicId,
			redirectUrl: input.publicAppUrl,
			redirectTo: withPath(input.publicAppUrl, '/dashboard'),
			impersonationToken,
			impersonationMaxAgeSeconds: IMPERSONATION_SECONDS,
			adminToken: input.adminToken
		}
	};
}

export async function adminStartImpersonationSession(
	db: Database,
	env: Pick<Env, 'COOKIE_ORIGIN' | 'JWT_SECRET' | 'PUBLIC_APP_URL'>,
	auth: AdminAuthSubject,
	input: {
		targetPublicId: string;
		cookieHeader: string | null;
	}
) {
	if (auth.type !== 'admin') {
		return { ok: false as const, body: { error: 'forbidden' as const }, status: 403 as const };
	}

	const adminToken = parseCookie(input.cookieHeader ?? '', COOKIE_TOKEN);
	const result = await adminStartImpersonation(db, {
		adminPublicId: auth.sub,
		targetPublicId: input.targetPublicId,
		adminToken: adminToken ?? null,
		jwtSecret: env.JWT_SECRET,
		publicAppUrl: env.PUBLIC_APP_URL
	});
	if (!result.ok)
		return { ok: false as const, body: { error: result.error }, status: result.status };

	return {
		ok: true as const,
		status: 201 as const,
		body: {
			ok: true,
			publicId: result.result.publicId,
			redirectUrl: result.result.redirectUrl,
			redirectTo: result.result.redirectTo
		},
		cookies: [
			jwtCookie({
				name: COOKIE_TOKEN,
				value: result.result.impersonationToken,
				cookieOrigin: env.COOKIE_ORIGIN,
				maxAgeSeconds: result.result.impersonationMaxAgeSeconds
			}),
			jwtCookie({
				name: COOKIE_ADMIN_TOKEN,
				value: result.result.adminToken,
				cookieOrigin: env.COOKIE_ORIGIN
			})
		]
	};
}

export async function adminStartImpersonationSessionForTarget(
	db: Database,
	env: Pick<Env, 'COOKIE_ORIGIN' | 'JWT_SECRET' | 'PUBLIC_APP_URL'>,
	auth: AdminAuthSubject,
	targetPublicId: string,
	cookieHeader: string | null
) {
	return adminStartImpersonationSession(db, env, auth, { targetPublicId, cookieHeader });
}

async function adminActor(db: Database, publicId: string): Promise<AdminActor | null> {
	const admin = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, publicId),
		columns: { id: true, publicId: true, username: true }
	});
	return admin ?? null;
}

async function adminActionSubjects(db: Database, adminPublicId: string, targetPublicId: string) {
	return Promise.all([
		db.query.adminUsers.findFirst({
			where: eq(adminUsers.publicId, adminPublicId),
			columns: { id: true, publicId: true }
		}),
		db.query.users.findFirst({
			where: and(eq(users.publicId, targetPublicId), isNull(users.deletedAt)),
			columns: { id: true, publicId: true }
		})
	]);
}
