import { isRegistrationOpen } from './registration';
import { and, eq, exists, gt, isNull, ne, sql } from 'drizzle-orm';
import { EmailDeliveryError, sendTemplate } from '@ak5/email';
import { COOKIE_TOKEN, PASSWORD_MAX_LENGTH, publicId, TIME_MS } from '@ak5/shared';
import type { z } from 'zod';
import type { Database } from '../db';
import { adminUsers, authEmail, tokens, users } from '../db/schema';
import type { Env } from '../types';
import { hashPassword, verifyPassword } from './password';
import { acceptInviteSchema, forgotPasswordSchema, loginSchema, registerSchema } from './auth-form';
import { jwtCookie, signJwt } from './jwt';
import { generateMagicToken, generatePin, issueToken, sha256Hex } from './tokens';
import { emailConfig } from '../middleware/email-config';
import { appRedirectUrl } from './return-paths';

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

type AuthWorkflowResult<TBody> =
	| {
			ok: true;
			body: TBody;
			setCookie?: string;
	  }
	| {
			ok: false;
			status: 400 | 401 | 403 | 404 | 409;
			body: { error: string };
	  };

export function preLoginAuthOptions(env: Env) {
	return {
		registrationOpen: isRegistrationOpen(env),
		password: {
			minLength: 8,
			maxLength: PASSWORD_MAX_LENGTH
		},
		username: {
			minLength: 5,
			maxLength: 20,
			pattern: '^[a-zA-Z0-9_]+$'
		}
	};
}

export async function registerUserPreAuth(
	db: Database,
	env: Env,
	input: RegisterInput
): Promise<AuthWorkflowResult<{ ok: true; publicId: string; verificationEmailSent: boolean }>> {
	if (!isRegistrationOpen(env))
		return { ok: false, status: 403, body: { error: 'registration_closed' } };

	const { email, password, username } = input;

	const existingUser = await db.query.users.findFirst({
		where: and(eq(users.username, username), isNull(users.deletedAt))
	});
	if (existingUser) return { ok: false, status: 409, body: { error: 'username_taken' } };

	const existingEmail = await db.query.users.findFirst({
		where: and(eq(users.email, email), isNull(users.deletedAt))
	});
	if (existingEmail) return { ok: false, status: 409, body: { error: 'email_taken' } };

	const userId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
	const userPub = publicId('user');

	await db.batch([
		db.insert(users).values({
			id: userId,
			publicId: userPub,
			username,
			email,
			emailVerified: false,
			role: 'user'
		}),
		db.insert(authEmail).values({
			subjectType: 'user',
			subjectId: userId,
			email,
			passwordHashed: await hashPassword(password),
			verified: false
		})
	]);

	const pin = generatePin();
	const expires = new Date(Date.now() + TIME_MS.ONE_HOUR);
	await issueToken(db, { userId }, 'verify_email', pin, expires);
	let verificationEmailSent = true;
	try {
		await sendTemplate(emailConfig(env), 'VerifyEmail', email, {
			pin,
			appUrl: env.PUBLIC_APP_URL
		});
	} catch (error) {
		if (!(error instanceof EmailDeliveryError)) throw error;
		verificationEmailSent = false;
	}

	const now = Math.floor(Date.now() / 1000);
	const jwt = await signJwt(env.JWT_SECRET, {
		sub: userPub,
		email,
		name: username,
		type: 'user',
		emailConfirmed: false,
		hasPassword: true,
		recentAuthAt: now
	});

	return {
		ok: true,
		body: { ok: true, publicId: userPub, verificationEmailSent },
		setCookie: jwtCookie({ name: COOKIE_TOKEN, value: jwt, cookieOrigin: env.COOKIE_ORIGIN })
	};
}

export async function loginUserPreAuth(
	db: Database,
	env: Env,
	input: LoginInput
): Promise<AuthWorkflowResult<{ ok: true; publicId: string }>> {
	const { email, password } = input;
	// Read the credential and session generation together; a concurrent password change
	// must not let an old password mint a token with the new generation.
	const [match] = await db
		.select({ identity: authEmail, account: users })
		.from(authEmail)
		.innerJoin(users, eq(users.id, authEmail.subjectId))
		.where(and(eq(authEmail.subjectType, 'user'), eq(authEmail.email, email)))
		.limit(1);
	if (!match || !(await verifyPassword(match.identity.passwordHashed, password))) {
		return { ok: false, status: 401, body: { error: 'invalid_credentials' } };
	}
	const user = match.account;
	if (!user || user.deletedAt || user.bannedAt) {
		return { ok: false, status: 401, body: { error: 'invalid_credentials' } };
	}

	const now = Math.floor(Date.now() / 1000);
	const jwt = await signJwt(env.JWT_SECRET, {
		sub: user.publicId,
		email: user.email ?? email,
		name: user.username,
		type: 'user',
		emailConfirmed: user.emailVerified,
		hasPassword: true,
		sessionVersion: user.sessionVersion,
		recentAuthAt: now
	});

	return {
		ok: true,
		body: { ok: true, publicId: user.publicId },
		setCookie: jwtCookie({ name: COOKIE_TOKEN, value: jwt, cookieOrigin: env.COOKIE_ORIGIN })
	};
}

export async function loginAdminPreAuth(
	db: Database,
	env: Env,
	input: LoginInput
): Promise<AuthWorkflowResult<{ ok: true; publicId: string }>> {
	const { email, password } = input;
	// Read the credential and session generation together; a concurrent password change
	// must not let an old password mint a token with the new generation.
	const [match] = await db
		.select({ identity: authEmail, account: adminUsers })
		.from(authEmail)
		.innerJoin(adminUsers, eq(adminUsers.id, authEmail.subjectId))
		.where(and(eq(authEmail.subjectType, 'admin'), eq(authEmail.email, email)))
		.limit(1);
	if (!match || !(await verifyPassword(match.identity.passwordHashed, password))) {
		return { ok: false, status: 401, body: { error: 'invalid_credentials' } };
	}
	const admin = match.account;
	if (!admin || admin.deletedAt) {
		return { ok: false, status: 401, body: { error: 'invalid_credentials' } };
	}

	const now = Math.floor(Date.now() / 1000);
	const jwt = await signJwt(env.JWT_SECRET, {
		sub: admin.publicId,
		email: admin.email,
		name: admin.username,
		type: 'admin',
		emailConfirmed: true,
		hasPassword: true,
		sessionVersion: admin.sessionVersion,
		recentAuthAt: now
	});

	return {
		ok: true,
		body: { ok: true, publicId: admin.publicId },
		setCookie: jwtCookie({ name: COOKIE_TOKEN, value: jwt, cookieOrigin: env.COOKIE_ORIGIN })
	};
}

export async function forgotUserPasswordPreAuth(
	db: Database,
	env: Env,
	input: ForgotPasswordInput,
	waitUntil: (promise: Promise<unknown>) => void
) {
	const { email } = input;
	const row = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.email, email))
	});

	if (row) {
		const token = generateMagicToken();
		await issueToken(
			db,
			{ userId: row.subjectId },
			'reset_password',
			token,
			new Date(Date.now() + 30 * 60 * 1000)
		);
		waitUntil(
			sendTemplate(emailConfig(env), 'ResetPassword', email, {
				token,
				appUrl: env.PUBLIC_APP_URL
			}).catch((error: unknown) => {
				if (!(error instanceof EmailDeliveryError)) throw error;
			})
		);
	}

	return {
		ok: true,
		successMessage: 'Check your email for a password reset link'
	};
}

export async function forgotAdminPasswordPreAuth(
	db: Database,
	env: Env,
	input: ForgotPasswordInput,
	waitUntil: (promise: Promise<unknown>) => void
) {
	const { email } = input;
	const row = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'admin'), eq(authEmail.email, email))
	});

	if (row) {
		const token = generateMagicToken();
		await issueToken(
			db,
			{ adminId: row.subjectId },
			'reset_password',
			token,
			new Date(Date.now() + 30 * 60 * 1000)
		);
		waitUntil(
			sendTemplate(emailConfig(env), 'ResetPassword', email, {
				token,
				appUrl: env.PUBLIC_ADMIN_URL
			}).catch((error: unknown) => {
				if (!(error instanceof EmailDeliveryError)) throw error;
			})
		);
	}

	return {
		ok: true,
		successMessage: 'If that admin account exists, a reset link has been sent.'
	};
}

export async function acceptInvitePreAuth(
	db: Database,
	env: Env,
	input: AcceptInviteInput
): Promise<
	AuthWorkflowResult<{
		ok: true;
		type: 'user' | 'admin';
		redirectUrl: string;
		redirectTo: string;
	}>
> {
	const { token, password, passwordConfirm } = input;
	if (passwordConfirm !== undefined && passwordConfirm !== password) {
		return { ok: false, status: 400, body: { error: 'passwords_do_not_match' } };
	}

	const hash = await sha256Hex(token);
	const [row] = await db
		.select()
		.from(tokens)
		.where(
			and(
				eq(tokens.purpose, 'reset_password'),
				eq(tokens.tokenHash, hash),
				gt(tokens.expiresAt, new Date())
			)
		)
		.limit(1);
	if (!row) return { ok: false, status: 400, body: { error: 'invalid_token' } };

	const subjectType = row.userId ? 'user' : 'admin';
	const subjectId = row.userId ?? row.adminId;
	if (!subjectId) return { ok: false, status: 400, body: { error: 'invalid_token' } };

	const identity = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, subjectType), eq(authEmail.subjectId, subjectId))
	});
	if (!identity) return { ok: false, status: 404, body: { error: 'identity_not_found' } };

	const passwordHashed = await hashPassword(password);
	const now = Math.floor(Date.now() / 1000);
	const liveToken = exists(
		db
			.select({ id: tokens.id })
			.from(tokens)
			.where(and(eq(tokens.id, row.id), gt(tokens.expiresAt, new Date())))
	);
	const stale = { ok: false, status: 400, body: { error: 'invalid_token' } } as const;
	if (subjectType === 'user') {
		const user = await db.query.users.findFirst({
			where: eq(users.id, subjectId)
		});
		if (!user || user.deletedAt)
			return { ok: false, status: 404, body: { error: 'user_not_found' } };
		if (user.bannedAt) return { ok: false, status: 403, body: { error: 'user_disabled' } };

		const copiedInvite =
			(row.payload as { purpose?: string } | null)?.purpose === 'invite_user_link';
		const eligible = and(eq(users.id, subjectId), isNull(users.deletedAt), isNull(users.bannedAt));
		const [, [updated]] = await db.batch([
			db
				.update(authEmail)
				.set({
					passwordHashed,
					...(!copiedInvite && { verified: true })
				})
				.where(
					and(
						eq(authEmail.id, identity.id),
						liveToken,
						exists(db.select({ id: users.id }).from(users).where(eligible))
					)
				),
			db
				.update(users)
				.set({
					...(!copiedInvite && { emailVerified: true }),
					lastLoginAt: new Date(),
					sessionVersion: sql`${users.sessionVersion} + 1`
				})
				.where(
					and(
						eligible,
						liveToken,
						exists(
							db.select({ id: authEmail.id }).from(authEmail).where(eq(authEmail.id, identity.id))
						)
					)
				)
				.returning({ sessionVersion: users.sessionVersion, emailVerified: users.emailVerified }),
			db.delete(tokens).where(and(eq(tokens.userId, subjectId), ne(tokens.id, row.id), liveToken)),
			db.delete(tokens).where(eq(tokens.id, row.id))
		]);

		if (!updated) return stale;

		const jwt = await signJwt(env.JWT_SECRET, {
			sub: user.publicId,
			email: user.email ?? identity.email,
			name: user.username,
			type: 'user',
			emailConfirmed: updated.emailVerified,
			hasPassword: true,
			sessionVersion: updated.sessionVersion,
			recentAuthAt: now
		});
		return {
			ok: true,
			body: {
				ok: true,
				type: 'user',
				redirectUrl: env.PUBLIC_APP_URL,
				redirectTo: appRedirectUrl(env.PUBLIC_APP_URL, '/dashboard')
			},
			setCookie: jwtCookie({ name: COOKIE_TOKEN, value: jwt, cookieOrigin: env.COOKIE_ORIGIN })
		};
	}

	const admin = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.id, subjectId)
	});
	if (!admin || admin.deletedAt) {
		return { ok: false, status: 404, body: { error: 'admin_not_found' } };
	}

	const eligible = and(eq(adminUsers.id, subjectId), isNull(adminUsers.deletedAt));
	const [, [updated]] = await db.batch([
		db
			.update(authEmail)
			.set({ passwordHashed, verified: true })
			.where(
				and(
					eq(authEmail.id, identity.id),
					liveToken,
					exists(db.select({ id: adminUsers.id }).from(adminUsers).where(eligible))
				)
			),
		db
			.update(adminUsers)
			.set({
				emailVerified: true,
				lastLoginAt: new Date(),
				sessionVersion: sql`${adminUsers.sessionVersion} + 1`
			})
			.where(
				and(
					eligible,
					liveToken,
					exists(
						db.select({ id: authEmail.id }).from(authEmail).where(eq(authEmail.id, identity.id))
					)
				)
			)
			.returning({ sessionVersion: adminUsers.sessionVersion }),
		db.delete(tokens).where(and(eq(tokens.adminId, subjectId), ne(tokens.id, row.id), liveToken)),
		db.delete(tokens).where(eq(tokens.id, row.id))
	]);

	if (!updated) return stale;

	const jwt = await signJwt(env.JWT_SECRET, {
		sub: admin.publicId,
		email: admin.email,
		name: admin.username,
		type: 'admin',
		emailConfirmed: true,
		hasPassword: true,
		sessionVersion: updated.sessionVersion,
		recentAuthAt: now
	});
	return {
		ok: true,
		body: {
			ok: true,
			type: 'admin',
			redirectUrl: env.PUBLIC_ADMIN_URL,
			redirectTo: appRedirectUrl(env.PUBLIC_ADMIN_URL, '/')
		},
		setCookie: jwtCookie({ name: COOKIE_TOKEN, value: jwt, cookieOrigin: env.COOKIE_ORIGIN })
	};
}
