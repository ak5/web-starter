import { and, eq, exists, gt, isNull, ne, sql } from 'drizzle-orm';
import { COOKIE_ADMIN_TOKEN, COOKIE_TOKEN, parseCookie, type JwtPayload } from '@ak5/shared';
import { EmailDeliveryError, sendTemplate } from '@ak5/email';
import type { Database } from '../db';
import { adminUsers, auditLog, authEmail, tokens, users } from '../db/schema';
import type { Env } from '../types';
import { hashPassword, verifyPassword } from './password';
import { clearJwtCookie, jwtCookie, signJwt, verifyJwt } from './jwt';
import { generateMagicToken, generatePin, issueToken, consumeToken, sha256Hex } from './tokens';
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
			columns: { id: true, deletedAt: true, bannedAt: true, sessionVersion: true }
		});
		if (!user || user.deletedAt || user.sessionVersion !== (auth.sessionVersion ?? 0))
			return { error: 'unauthorized', status: 401 };
		if (user.bannedAt && !auth.impersonatedBy) {
			return { error: 'user_disabled', status: 403 };
		}
		return { subjectType: 'user', subjectId: user.id };
	}

	const admin = await db.query.adminUsers.findFirst({
		where: eq(adminUsers.publicId, auth.sub),
		columns: { id: true, deletedAt: true, sessionVersion: true }
	});
	if (!admin || admin.deletedAt || admin.sessionVersion !== (auth.sessionVersion ?? 0))
		return { error: 'unauthorized', status: 401 };
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
		columns: { id: true, publicId: true, deletedAt: true, sessionVersion: true }
	});
	if (!admin || admin.deletedAt || admin.sessionVersion !== (adminPayload.sessionVersion ?? 0))
		return { ok: false, status: 403, body: { error: 'invalid_admin_token' } };

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

	const row = await consumeToken(db, 'verify_email', pin, subjectTokenRef(subject));
	if (!row) return { ok: false, status: 400, body: { error: 'invalid_pin' } };
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

	const table = subject.subjectType === 'user' ? users : adminUsers;
	const [, [updated]] = await db.batch([
		db.insert(authEmail).values({
			subjectType: subject.subjectType,
			subjectId: subject.subjectId,
			email: auth.email,
			passwordHashed: await hashPassword(newPassword),
			verified: auth.emailConfirmed
		}),
		db
			.update(table)
			.set({ sessionVersion: sql`${table.sessionVersion} + 1` })
			.where(eq(table.id, subject.subjectId))
			.returning({ sessionVersion: table.sessionVersion }),
		db
			.delete(tokens)
			.where(eq(subject.subjectType === 'user' ? tokens.userId : tokens.adminId, subject.subjectId))
	]);

	const jwt = await signJwt(env.JWT_SECRET, {
		...auth,
		hasPassword: true,
		sessionVersion: updated.sessionVersion,
		recentAuthAt: Math.floor(Date.now() / 1000)
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
	env: Env,
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

	const table = subject.subjectType === 'user' ? users : adminUsers;
	const [, [updated]] = await db.batch([
		db
			.update(authEmail)
			.set({ passwordHashed: await hashPassword(input.newPassword) })
			.where(eq(authEmail.id, emailRow.id)),
		db
			.update(table)
			.set({ sessionVersion: sql`${table.sessionVersion} + 1` })
			.where(eq(table.id, subject.subjectId))
			.returning({ sessionVersion: table.sessionVersion }),
		db
			.delete(tokens)
			.where(eq(subject.subjectType === 'user' ? tokens.userId : tokens.adminId, subject.subjectId))
	]);
	const jwt = await signJwt(env.JWT_SECRET, {
		...auth,
		sessionVersion: updated.sessionVersion,
		recentAuthAt: Math.floor(Date.now() / 1000)
	});
	return {
		ok: true,
		body: { ok: true, successMessage: 'Password updated. Other sessions have been signed out.' },
		setCookie: authCookie(env, jwt)
	};
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
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };
	const row = await consumeToken(db, 'magic_login', token, subjectTokenRef(subject));
	if (!row) return { ok: false, status: 400, body: { error: 'invalid_token' } };
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

function accountVersionGuard(
	subject: AuthSubject,
	auth: JwtPayload,
	version = auth.sessionVersion ?? 0
) {
	const table = subject.subjectType === 'user' ? users : adminUsers;
	return and(
		eq(table.id, subject.subjectId),
		eq(table.sessionVersion, version),
		isNull(table.deletedAt),
		subject.subjectType === 'user' ? isNull(users.bannedAt) : undefined
	);
}

async function emailChangeAccount(
	db: Database,
	auth: JwtPayload
): Promise<
	| { subject: AuthSubject; identity: typeof authEmail.$inferSelect }
	| { error: string; status: 400 | 401 | 403 }
> {
	if (auth.impersonatedBy) return { error: 'forbidden', status: 403 } as const;
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject) return subject;
	const identity = await db.query.authEmail.findFirst({
		where: and(
			eq(authEmail.subjectType, subject.subjectType),
			eq(authEmail.subjectId, subject.subjectId)
		)
	});
	if (!identity) return { error: 'no_password', status: 400 } as const;
	return { subject, identity };
}

function emailChangeHash(env: Env, subject: AuthSubject, code: string) {
	return sha256Hex(`${env.JWT_SECRET}:${subject.subjectType}:${subject.subjectId}:${code}`);
}

export async function requestEmailChange(
	db: Database,
	env: Env,
	auth: JwtPayload,
	newEmail: string
): Promise<PostAuthResult<{ ok: true; successMessage: string }>> {
	const account = await emailChangeAccount(db, auth);
	if ('error' in account)
		return { ok: false, status: account.status, body: { error: account.error } };
	const { subject, identity } = account;
	if (newEmail === identity.email)
		return { ok: false, status: 409, body: { error: 'email_unchanged' } };
	const table = subject.subjectType === 'user' ? users : adminUsers;
	const [existing] = await db
		.select({ id: table.id })
		.from(table)
		.where(and(eq(table.email, newEmail), isNull(table.deletedAt)))
		.limit(1);
	const reserved = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, subject.subjectType), eq(authEmail.email, newEmail)),
		columns: { id: true }
	});
	if (existing || reserved) return { ok: false, status: 409, body: { error: 'email_taken' } };
	const config = emailConfig(env);
	const deliveryFailed = {
		ok: false,
		status: 503,
		body: { error: 'email_delivery_failed' }
	} as const;
	if (!config.fromAddress.trim() || (!config.email && !config.mockApiUrl)) return deliveryFailed;

	const id = crypto.randomUUID();
	const code = generatePin();
	const hash = await emailChangeHash(env, subject, code);
	const active = exists(
		db.select({ id: table.id }).from(table).where(accountVersionGuard(subject, auth))
	);
	const tokenAccount = eq(
		subject.subjectType === 'user' ? tokens.userId : tokens.adminId,
		subject.subjectId
	);
	const [created] = await db.batch([
		db
			.insert(tokens)
			.select(
				sql`SELECT ${id},
			${subject.subjectType === 'user' ? subject.subjectId : null},
			${subject.subjectType === 'admin' ? subject.subjectId : null},
			'email_change', ${hash}, ${Date.now() + 600_000}, 0,
			${JSON.stringify({ newEmail })}, ${Date.now()} WHERE ${active}`
			)
			.returning({ id: tokens.id }),
		db
			.delete(tokens)
			.where(and(tokenAccount, eq(tokens.purpose, 'email_change'), ne(tokens.id, id), active))
	]);
	if (!created.length) return { ok: false, status: 401, body: { error: 'unauthorized' } };
	try {
		if (await sendTemplate(config, 'EmailChange', newEmail, { code }))
			return {
				ok: true,
				body: { ok: true, successMessage: 'Check the new address for your code.' }
			};
	} catch (error) {
		if (!(error instanceof EmailDeliveryError)) throw error;
	}
	await db.delete(tokens).where(eq(tokens.id, id));
	return deliveryFailed;
}

export async function confirmEmailChange(
	db: Database,
	env: Env,
	auth: JwtPayload,
	code: string,
	waitUntil: (task: Promise<unknown>) => void
): Promise<PostAuthResult<{ ok: true; successMessage: string }>> {
	const account = await emailChangeAccount(db, auth);
	if ('error' in account)
		return { ok: false, status: account.status, body: { error: account.error } };
	const { subject, identity } = account;
	const table = subject.subjectType === 'user' ? users : adminUsers;
	const tokenAccount = eq(
		subject.subjectType === 'user' ? tokens.userId : tokens.adminId,
		subject.subjectId
	);
	const hash = await emailChangeHash(env, subject, code);
	const matching = and(
		tokenAccount,
		eq(tokens.purpose, 'email_change'),
		eq(tokens.tokenHash, hash),
		gt(tokens.expiresAt, new Date())
	);
	const row = await db.query.tokens.findFirst({ where: matching });
	const invalid = { ok: false, status: 400, body: { error: 'invalid_email_change_code' } } as const;
	const newEmail = (row?.payload as { newEmail?: string } | null)?.newEmail;
	if (!row || !newEmail) return invalid;
	const liveToken = exists(
		db
			.select({ id: tokens.id })
			.from(tokens)
			.where(and(eq(tokens.id, row.id), gt(tokens.expiresAt, new Date())))
	);
	const guarded = accountVersionGuard(subject, auth);

	const identityGuard = and(eq(authEmail.id, identity.id), eq(authEmail.email, identity.email));
	const hasIdentity = exists(db.select({ id: authEmail.id }).from(authEmail).where(identityGuard));
	const version = (auth.sessionVersion ?? 0) + 1;
	const committed = exists(
		db
			.select({ id: table.id })
			.from(table)
			.where(and(accountVersionGuard(subject, auth, version), eq(table.email, newEmail)))
	);
	try {
		const [[updated]] = await db.batch([
			db
				.update(table)
				.set({ email: newEmail, emailVerified: true, sessionVersion: version })
				.where(and(guarded, liveToken, hasIdentity))
				.returning({ id: table.id }),
			db
				.update(authEmail)
				.set({ email: newEmail, verified: true })
				.where(and(identityGuard, liveToken, committed)),
			db.delete(tokens).where(and(tokenAccount, liveToken, ne(tokens.id, row.id), committed)),
			db.delete(tokens).where(eq(tokens.id, row.id))
		]);
		if (!updated) return invalid;
	} catch (error) {
		if (
			!(error instanceof Error) ||
			!/unique constraint failed/i.test(String(error.cause ?? error))
		)
			throw error;
		return { ok: false, status: 409, body: { error: 'email_taken' } };
	}
	const jwt = await signJwt(env.JWT_SECRET, {
		...auth,
		email: newEmail,
		emailConfirmed: true,
		sessionVersion: version
	});
	waitUntil(
		sendTemplate(emailConfig(env), 'EmailChanged', identity.email, {}).catch(() => undefined)
	);
	return {
		ok: true,
		body: { ok: true, successMessage: 'Email updated.' },
		setCookie: authCookie(env, jwt)
	};
}

export async function logoutAllPostAuth(
	db: Database,
	env: Env,
	auth: JwtPayload
): Promise<PostAuthResult<{ ok: true }>> {
	if (auth.impersonatedBy) return { ok: false, status: 403, body: { error: 'forbidden' } };
	const subject = await getActiveAuthSubjectByAuth(db, auth);
	if ('error' in subject)
		return { ok: false, status: subject.status, body: { error: subject.error } };
	const table = subject.subjectType === 'user' ? users : adminUsers;
	const version = (auth.sessionVersion ?? 0) + 1;
	const tokenAccount = eq(
		subject.subjectType === 'user' ? tokens.userId : tokens.adminId,
		subject.subjectId
	);
	const guarded = accountVersionGuard(subject, auth);
	const [, [updated]] = await db.batch([
		db
			.delete(tokens)
			.where(and(tokenAccount, exists(db.select({ id: table.id }).from(table).where(guarded)))),
		db.update(table).set({ sessionVersion: version }).where(guarded).returning({ id: table.id })
	]);
	if (!updated) return { ok: false, status: 401, body: { error: 'unauthorized' } };
	return {
		ok: true,
		body: { ok: true },
		setCookie: clearJwtCookie(COOKIE_TOKEN, env.COOKIE_ORIGIN)
	};
}
