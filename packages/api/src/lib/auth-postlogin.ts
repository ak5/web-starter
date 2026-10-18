import { and, eq } from 'drizzle-orm';
import { COOKIE_ADMIN_TOKEN, COOKIE_TOKEN, parseCookie, type JwtPayload } from '@ak5/shared';
import { EmailDeliveryError, sendTemplate } from '@ak5/email';
import type { Database } from '../db';
import { adminUsers, auditLog, authEmail, users } from '../db/schema';
import type { Env } from '../types';
import { hashPassword, verifyPassword } from './password';
import { clearJwtCookie, jwtCookie, signJwt, verifyJwt } from './jwt';
import { generateMagicToken, generatePin, issueToken, consumeToken } from './tokens';
import { emailConfig } from '../middleware/email-config';

type AuthSubject =
	{ subjectType: 'user'; subjectId: string } | { subjectType: 'admin'; subjectId: string };

type PostAuthResult<TBody> =
	| { ok: true; body: TBody; setCookie?: string }
	| { ok: false; status: 400 | 401 | 403 | 404 | 409 | 503; body: { error: string } };

type MultiCookiePostAuthResult<TBody> =
	| { ok: true; body: TBody; setCookies?: string[] }
	| { ok: false; status: 400 | 401 | 403 | 404; body: { error: string } };

async function getActiveAuthSubjectByAuth(
	db: Database,
	auth: JwtPayload
): Promise<AuthSubject | { error: string; status: 401 | 403 }> {
	if (auth.type === 'user') {
		const user = await db.query.users.findFirst({
			where: eq(users.publicId, auth.sub),
			columns: { id: true, deletedAt: true, bannedAt: true }
		});
		if (!user || user.deletedAt) return { error: 'unauthorized', status: 401 };
		if (user.bannedAt && !auth.impersonatedBy) {
			return { error: 'user_disabled', status: 403 };
		}
		return { subjectType: 'user', subjectId: user.id };
	}

	const admin = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, auth.sub),
		columns: { id: true, deletedAt: true }
	});
	if (!admin || admin.deletedAt) return { error: 'unauthorized', status: 401 };
	return { subjectType: 'admin', subjectId: admin.id };
}

function subjectTokenRef(subject: AuthSubject) {
	return subject.subjectType === 'user'
		? { userId: subject.subjectId }
		: { adminId: subject.subjectId };
}

function authCookie(env: Env, value: string) {
	return jwtCookie({ name: COOKIE_TOKEN, value, cookieOrigin: env.COOKIE_ORIGIN });
}

export function authSubjectSummary(auth: JwtPayload) {
	return {
		sub: auth.sub,
		email: auth.email,
		name: auth.name,
		type: auth.type,
		emailConfirmed: auth.emailConfirmed,
		hasPassword: auth.hasPassword,
		recentAuthAt: auth.recentAuthAt,
		impersonatedBy: auth.impersonatedBy
	};
}

export function logoutPostAuth(env: Env): MultiCookiePostAuthResult<{ ok: true }> {
	return {
		ok: true,
		body: { ok: true },
		setCookies: [
			clearJwtCookie(COOKIE_TOKEN, env.COOKIE_ORIGIN),
			clearJwtCookie(COOKIE_ADMIN_TOKEN, env.COOKIE_ORIGIN)
		]
	};
}

export async function stopImpersonationPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload,
	cookieHeader: string
): Promise<MultiCookiePostAuthResult<{ ok: true; redirectUrl: string }>> {
	if (auth.type !== 'user' || !auth.impersonatedBy) {
		return { ok: false, status: 400, body: { error: 'not_impersonating' } };
	}

	const adminToken = parseCookie(cookieHeader, COOKIE_ADMIN_TOKEN);
	if (!adminToken) return { ok: false, status: 400, body: { error: 'missing_admin_token' } };

	const adminPayload = await verifyJwt(env.JWT_SECRET, adminToken);
	if (!adminPayload || adminPayload.type !== 'admin' || adminPayload.sub !== auth.impersonatedBy) {
		return { ok: false, status: 403, body: { error: 'invalid_admin_token' } };
	}

	const admin = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, adminPayload.sub),
		columns: { id: true, publicId: true }
	});
	if (!admin) return { ok: false, status: 404, body: { error: 'admin_not_found' } };

	await db.insert(auditLog).values({
		adminId: admin.id,
		action: 'user.impersonate.stop',
		entityType: 'user',
		entityId: auth.sub,
		payload: { userPublicId: auth.sub, adminPublicId: admin.publicId }
	});

	return {
		ok: true,
		body: { ok: true, redirectUrl: env.PUBLIC_ADMIN_URL },
		setCookies: [
			jwtCookie({ name: COOKIE_TOKEN, value: adminToken, cookieOrigin: env.COOKIE_ORIGIN }),
			clearJwtCookie(COOKIE_ADMIN_TOKEN, env.COOKIE_ORIGIN)
		]
	};
}

export async function verifyEmailPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload,
	pin: string
): Promise<PostAuthResult<{ ok: true }>> {
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };

	const row = await consumeToken(db, 'verify_email', pin);
	if (!row) return { ok: false, status: 400, body: { error: 'invalid_pin' } };
	if (
		(subject.subjectType === 'user' && row.userId !== subject.subjectId) ||
		(subject.subjectType === 'admin' && row.adminId !== subject.subjectId)
	) {
		return { ok: false, status: 400, body: { error: 'invalid_pin' } };
	}
	if (subject.subjectType === 'user') {
		await db.update(users).set({ emailVerified: true }).where(eq(users.id, subject.subjectId));
		await db
			.update(authEmail)
			.set({ verified: true })
			.where(and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, subject.subjectId)));
	} else {
		await db
			.update(adminUsers)
			.set({ emailVerified: true })
			.where(eq(adminUsers.id, subject.subjectId));
	}

	const jwt = await signJwt(env.JWT_SECRET, {
		...auth,
		emailConfirmed: true,
		recentAuthAt: Math.floor(Date.now() / 1000)
	});
	return {
		ok: true,
		body: { ok: true },
		setCookie: authCookie(env, jwt)
	};
}

export async function verifyEmailPostAuthWithInput(
	db: Database,
	env: Env,
	auth: JwtPayload,
	input: { pin: string }
) {
	return verifyEmailPostAuth(db, env, auth, input.pin);
}

export async function resendVerificationPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload
): Promise<PostAuthResult<{ ok: true }>> {
	if (auth.emailConfirmed) return { ok: true, body: { ok: true } };
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };

	const pin = generatePin();
	const expires = new Date(Date.now() + 60 * 60 * 1000);
	await issueToken(db, subjectTokenRef(subject), 'verify_email', pin, expires);
	try {
		await sendTemplate(emailConfig(env), 'VerifyEmail', auth.email, {
			pin,
			appUrl: auth.type === 'admin' ? env.PUBLIC_ADMIN_URL : env.PUBLIC_APP_URL
		});
	} catch (error) {
		if (!(error instanceof EmailDeliveryError)) throw error;
		return { ok: false, status: 503, body: { error: 'email_delivery_failed' } };
	}
	return { ok: true, body: { ok: true } };
}

export async function setPasswordPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload,
	newPassword: string
): Promise<PostAuthResult<{ ok: true; successMessage: string }>> {
	if (auth.hasPassword) return { ok: false, status: 400, body: { error: 'already_has_password' } };

	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };

	const existing = await db.query.authEmail.findFirst({
		where: and(
			eq(authEmail.subjectType, subject.subjectType),
			eq(authEmail.subjectId, subject.subjectId)
		)
	});
	if (existing) return { ok: false, status: 400, body: { error: 'already_has_password' } };

	const existingEmail = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, subject.subjectType), eq(authEmail.email, auth.email))
	});
	if (existingEmail) return { ok: false, status: 409, body: { error: 'email_taken' } };

	await db.insert(authEmail).values({
		subjectType: subject.subjectType,
		subjectId: subject.subjectId,
		email: auth.email,
		passwordHashed: await hashPassword(newPassword),
		verified: auth.emailConfirmed
	});

	const jwt = await signJwt(env.JWT_SECRET, {
		sub: auth.sub,
		email: auth.email,
		name: auth.name,
		type: auth.type,
		emailConfirmed: auth.emailConfirmed,
		hasPassword: true,
		recentAuthAt: Math.floor(Date.now() / 1000),
		impersonatedBy: auth.impersonatedBy
	});
	return {
		ok: true,
		body: { ok: true, successMessage: 'Password updated.' },
		setCookie: authCookie(env, jwt)
	};
}

export async function setPasswordPostAuthWithInput(
	db: Database,
	env: Env,
	auth: JwtPayload,
	input: { newPassword: string }
) {
	return setPasswordPostAuth(db, env, auth, input.newPassword);
}

export async function changePasswordPostAuth(
	db: Database,
	auth: JwtPayload,
	input: { currentPassword: string; newPassword: string }
): Promise<PostAuthResult<{ ok: true; successMessage: string }>> {
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };

	const emailRow = await db.query.authEmail.findFirst({
		where: and(
			eq(authEmail.subjectType, subject.subjectType),
			eq(authEmail.subjectId, subject.subjectId)
		)
	});
	if (!emailRow) return { ok: false, status: 400, body: { error: 'no_password' } };
	const ok = await verifyPassword(emailRow.passwordHashed, input.currentPassword);
	if (!ok) return { ok: false, status: 400, body: { error: 'invalid_current_password' } };

	await db
		.update(authEmail)
		.set({ passwordHashed: await hashPassword(input.newPassword) })
		.where(eq(authEmail.id, emailRow.id));
	return { ok: true, body: { ok: true, successMessage: 'Password updated.' } };
}

export async function requestReauthPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload
): Promise<PostAuthResult<{ ok: true; successMessage: string }>> {
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };

	const token = generateMagicToken();
	await issueToken(
		db,
		subjectTokenRef(subject),
		'magic_login',
		token,
		new Date(Date.now() + 30 * 60 * 1000)
	);
	try {
		const appUrl = auth.type === 'admin' ? env.PUBLIC_ADMIN_URL : env.PUBLIC_APP_URL;
		const magicUrl = new URL(`/auth/magic/${encodeURIComponent(token)}`, appUrl);
		magicUrl.searchParams.set('next', '/account/password');
		await sendTemplate(emailConfig(env), 'LoginWith', auth.email, {
			identities: [['email', auth.email]],
			appUrl: magicUrl.toString()
		});
	} catch (error) {
		if (!(error instanceof EmailDeliveryError)) throw error;
		return { ok: false, status: 503, body: { error: 'email_delivery_failed' } };
	}
	return { ok: true, body: { ok: true, successMessage: 'Check your email to continue.' } };
}

export async function magicLoginPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload,
	token: string
): Promise<PostAuthResult<{ ok: true }>> {
	const row = await consumeToken(db, 'magic_login', token);
	if (!row) return { ok: false, status: 400, body: { error: 'invalid_token' } };
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };
	if (
		(subject.subjectType === 'user' && row.userId !== subject.subjectId) ||
		(subject.subjectType === 'admin' && row.adminId !== subject.subjectId)
	) {
		return { ok: false, status: 400, body: { error: 'invalid_token' } };
	}
	const jwt = await signJwt(env.JWT_SECRET, {
		...auth,
		recentAuthAt: Math.floor(Date.now() / 1000)
	});
	return {
		ok: true,
		body: { ok: true },
		setCookie: authCookie(env, jwt)
	};
}

export async function magicLoginPostAuthWithInput(
	db: Database,
	env: Env,
	auth: JwtPayload,
	input: { token: string }
) {
	return magicLoginPostAuth(db, env, auth, input.token);
}
