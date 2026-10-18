import { desc, eq, inArray, or } from 'drizzle-orm';

import type { Database } from '../db';
import { adminUsers, authEmail, tokens, users } from '../db/schema';
import { isLocalDiagnosticsEnabled, payloadKeys, type LocalDiagnosticsEnv } from './admin-display';

export async function adminTokenDiagnosticsResponse(
	db: Database,
	env: LocalDiagnosticsEnv,
	email: string
) {
	if (!isLocalDiagnosticsEnabled(env)) {
		return { ok: false as const, body: { message: 'Not found' }, status: 404 as const };
	}

	const result = await adminTokenDiagnostics(db, email);
	if (!result.ok) {
		return { ok: false as const, body: { message: 'No identity found' }, status: 404 as const };
	}

	return { ok: true as const, body: result.diagnostics };
}

export async function adminTokenDiagnostics(db: Database, email: string) {
	const identities = await db.query.authEmail.findMany({
		where: eq(authEmail.email, email),
		columns: {
			subjectType: true,
			subjectId: true,
			email: true,
			verified: true
		}
	});
	if (!identities.length) return { ok: false as const, error: 'not_found' as const };

	const userIds = identities
		.filter((identity) => identity.subjectType === 'user')
		.map((identity) => identity.subjectId);
	const adminIds = identities
		.filter((identity) => identity.subjectType === 'admin')
		.map((identity) => identity.subjectId);

	const [userRows, adminRows] = await Promise.all([
		userIds.length
			? db.query.users.findMany({
					where: inArray(users.id, userIds),
					columns: { id: true, publicId: true, username: true, emailVerified: true }
				})
			: [],
		adminIds.length
			? db.query.adminUsers.findMany({
					where: inArray(adminUsers.id, adminIds),
					columns: { id: true, publicId: true, username: true, emailVerified: true }
				})
			: []
	]);

	const tokenWhere = or(
		userIds.length ? inArray(tokens.userId, userIds) : undefined,
		adminIds.length ? inArray(tokens.adminId, adminIds) : undefined
	);
	const tokenRows = tokenWhere
		? await db.query.tokens.findMany({
				where: tokenWhere,
				orderBy: [desc(tokens.createdAt)]
			})
		: [];

	const usersById = new Map(userRows.map((user) => [user.id, user]));
	const adminsById = new Map(adminRows.map((admin) => [admin.id, admin]));

	return {
		ok: true as const,
		diagnostics: {
			exists: true,
			email,
			identities: identities.map((identity) => {
				const subject =
					identity.subjectType === 'user'
						? usersById.get(identity.subjectId)
						: adminsById.get(identity.subjectId);
				return {
					type: identity.subjectType,
					publicId: subject?.publicId ?? null,
					username: subject?.username ?? null,
					emailVerified: subject?.emailVerified ?? false,
					authEmailVerified: identity.verified
				};
			}),
			tokens: tokenRows.map((token) => ({
				id: token.id,
				subjectType: token.userId ? 'user' : 'admin',
				subjectPublicId: token.userId
					? (usersById.get(token.userId)?.publicId ?? null)
					: token.adminId
						? (adminsById.get(token.adminId)?.publicId ?? null)
						: null,
				purpose: token.purpose,
				attempts: token.attempts,
				createdAt: token.createdAt,
				expiresAt: token.expiresAt,
				expired: token.expiresAt <= new Date(),
				hasHash: Boolean(token.tokenHash),
				hasPayload: Boolean(token.payload),
				payloadKeys: payloadKeys(token.payload)
			}))
		}
	};
}
