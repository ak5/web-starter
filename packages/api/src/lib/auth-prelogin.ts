import { and, eq, isNull } from 'drizzle-orm';
import { EmailDeliveryError, sendTemplate } from '@ak5/email';
import {
	COOKIE_TOKEN,
	LEGAL_ACCEPTANCE_ERROR,
	LEGAL_SIGNUP_ACCEPTANCE_COOKIE,
	PASSWORD_MAX_LENGTH,
	publicId,
	TIME_MS
} from '@ak5/shared';
import type { z } from 'zod';
import type { Database } from '../db';
import { adminUsers, authEmail, users } from '../db/schema';
import type { Env } from '../types';
import { LEGAL_VERSIONS } from './legal';
import { hashPassword, verifyPassword } from './password';
import { acceptInviteSchema, forgotPasswordSchema, loginSchema, registerSchema } from './auth-form';
import { jwtCookie, signJwt } from './jwt';
import { generateMagicToken, generatePin, issueToken, consumeToken } from './tokens';
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

export function preLoginAuthOptions() {
	return {
		password: {
			minLength: 8,
			maxLength: PASSWORD_MAX_LENGTH
		},
		username: {
			minLength: 5,
			maxLength: 20,
			pattern: '^[a-zA-Z0-9_]+$'
		},
		legalAcceptance: {
			error: LEGAL_ACCEPTANCE_ERROR,
			signupCookie: {
				name: LEGAL_SIGNUP_ACCEPTANCE_COOKIE,
				value: LEGAL_VERSIONS.terms,
				maxAgeSeconds: 60 * 10
			}
		}
	};
}

export async function registerUserPreAuth(
	db: Database,
	env: Env,
	input: RegisterInput
): Promise<AuthWorkflowResult<{ ok: true; publicId: string; verificationEmailSent: boolean }>> {
	const { email, password, username, legalAcceptance } = input;
	if (legalAcceptance !== true) {
		return { ok: false, status: 400, body: { error: 'legal_acceptance_required' } };
	}

	const existingUser = await db.query.users.findFirst({
		where: and(eq(users.username, username), isNull(users.deletedAt))
	});
	if (existingUser) return { ok: false, status: 409, body: { error: 'username_taken' } };

	const existingEmail = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.email, email))
	});
	if (existingEmail) return { ok: false, status: 409, body: { error: 'email_taken' } };

	const userId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
	const userPub = publicId('user');

	await db.transaction(async (tx) => {
		await tx.insert(users).values({
			id: userId,
			publicId: userPub,
			username,
			email,
			emailVerified: false,
			role: 'user',
			termsAcceptedAt: new Date(),
			termsVersion: LEGAL_VERSIONS.terms,
			privacyVersion: LEGAL_VERSIONS.privacy,
			acceptableUseVersion: LEGAL_VERSIONS.acceptableUse
		});
		await tx.insert(authEmail).values({
			subjectType: 'user',
			subjectId: userId,
			email,
			passwordHashed: await hashPassword(password),
			verified: false
		});
	});

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
	const row = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.email, email))
	});
	if (!row) return { ok: false, status: 401, body: { error: 'invalid_credentials' } };

	const ok = await verifyPassword(row.passwordHashed, password);
	if (!ok) return { ok: false, status: 401, body: { error: 'invalid_credentials' } };

	const user = await db.query.users.findFirst({
		where: eq(users.id, row.subjectId)
	});
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
	const row = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'admin'), eq(authEmail.email, email))
	});
	if (!row) return { ok: false, status: 401, body: { error: 'invalid_credentials' } };

	const ok = await verifyPassword(row.passwordHashed, password);
	if (!ok) return { ok: false, status: 401, body: { error: 'invalid_credentials' } };

	const admin = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.id, row.subjectId)
	});
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

	const row = await consumeToken(db, 'reset_password', token);
	if (!row) return { ok: false, status: 400, body: { error: 'invalid_token' } };

	const subjectType = row.userId ? 'user' : 'admin';
	const subjectId = row.userId ?? row.adminId;
	if (!subjectId) return { ok: false, status: 400, body: { error: 'invalid_token' } };

	const identity = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, subjectType), eq(authEmail.subjectId, subjectId))
	});
	if (!identity) return { ok: false, status: 404, body: { error: 'identity_not_found' } };

	const now = Math.floor(Date.now() / 1000);
	if (subjectType === 'user') {
		const user = await db.query.users.findFirst({
			where: eq(users.id, subjectId)
		});
		if (!user || user.deletedAt)
			return { ok: false, status: 404, body: { error: 'user_not_found' } };
		if (user.bannedAt) return { ok: false, status: 403, body: { error: 'user_disabled' } };

		await db.transaction(async (tx) => {
			await tx
				.update(authEmail)
				.set({ passwordHashed: await hashPassword(password), verified: true })
				.where(eq(authEmail.id, identity.id));
			await tx
				.update(users)
				.set({ emailVerified: true, lastLoginAt: new Date() })
				.where(eq(users.id, subjectId));
		});

		const jwt = await signJwt(env.JWT_SECRET, {
			sub: user.publicId,
			email: user.email ?? identity.email,
			name: user.username,
			type: 'user',
			emailConfirmed: true,
			hasPassword: true,
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

	await db.transaction(async (tx) => {
		await tx
			.update(authEmail)
			.set({ passwordHashed: await hashPassword(password), verified: true })
			.where(eq(authEmail.id, identity.id));
		await tx
			.update(adminUsers)
			.set({ emailVerified: true, lastLoginAt: new Date() })
			.where(eq(adminUsers.id, subjectId));
	});

	const jwt = await signJwt(env.JWT_SECRET, {
		sub: admin.publicId,
		email: admin.email,
		name: admin.username,
		type: 'admin',
		emailConfirmed: true,
		hasPassword: true,
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
