/**
 * Discord OAuth — login provider for users (and the legacy admin path
 * before email/password admin login was added). The flow:
 *
 *   1. /oauth/discord                  → 302 to discord.com/oauth2/authorize
 *   2. discord redirects back with ?code=…
 *   3. POST to discord.com/api/oauth2/token to exchange code → access_token
 *   4. GET https://discord.com/api/users/@me → discord profile
 *   5. find or create local user row + auth_discord row, mint JWT, redirect
 *
 * The discord access_token is stored unencrypted (it expires in 7 days and
 * we re-fetch on demand via refresh_token); the refresh_token is stored
 * AES-encrypted via `encryptToken` because it is long-lived.
 */
import type { Context } from 'hono';
import { deleteCookie, getCookie } from 'hono/cookie';
import { and, eq } from 'drizzle-orm';
import {
	COOKIE_TOKEN,
	LEGAL_SIGNUP_ACCEPTANCE_COOKIE,
	LEGAL_VERSIONS,
	publicId,
	type JwtPayload
} from '@ak5/shared';
import type { Database } from '../../db';
import { authDiscord, authEmail, users } from '../../db/schema';
import type { AppContext, Env } from '../../types';
import { apiErrorJson } from '../api-response';
import { encryptToken } from '../crypto';
import { jwtCookie, signJwt } from '../jwt';
import { responseJson } from '../request-parsing';
import {
	cookieOptions,
	issueOAuthState,
	redirectToApp,
	redirectToWeb,
	validateOAuthState
} from './state';

export interface DiscordTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string;
	token_type: 'Bearer';
}

export interface DiscordProfile {
	id: string;
	username: string;
	global_name?: string;
	avatar?: string;
	email?: string;
	verified?: boolean;
}

export function discordAuthorizeUrl(env: Env, state: string) {
	const url = new URL('https://discord.com/api/oauth2/authorize');
	url.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
	url.searchParams.set('redirect_uri', `${env.PUBLIC_API_URL}/oauth/discord/callback`);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'identify email');
	url.searchParams.set('state', state);
	return url.toString();
}

export function startDiscordOAuth(c: Context<AppContext>) {
	const state = issueOAuthState(c, 'discord');
	return c.redirect(discordAuthorizeUrl(c.env, state));
}

export async function handleDiscordOAuthCallbackResponse(c: Context<AppContext>) {
	if (!validateOAuthState(c, 'discord')) {
		return redirectToWeb(c, '/login?error=invalid_oauth_state');
	}

	const code = c.req.query('code');
	const oauthError = c.req.query('error');
	if (oauthError) return redirectToWeb(c, `/login?error=${encodeURIComponent(oauthError)}`);
	if (!code) return redirectToWeb(c, '/login?error=missing_code');

	const acceptedLegal = getCookie(c, LEGAL_SIGNUP_ACCEPTANCE_COOKIE) === LEGAL_VERSIONS.terms;
	deleteCookie(c, LEGAL_SIGNUP_ACCEPTANCE_COOKIE, cookieOptions(c));

	const result = await handleDiscordOAuthCallback({
		db: c.var.db,
		env: c.env,
		auth: c.var.auth,
		code,
		acceptedLegal
	});

	if (result.kind === 'disabled') return apiErrorJson(c, result);
	if (result.kind === 'connect' || result.kind === 'redirect') {
		return redirectToWeb(c, result.redirectTo);
	}

	const jwt = await signJwt(c.env.JWT_SECRET, result.jwtPayload);
	c.header(
		'set-cookie',
		jwtCookie({ name: COOKIE_TOKEN, value: jwt, cookieOrigin: c.env.COOKIE_ORIGIN })
	);
	return redirectToApp(c);
}

export async function exchangeDiscordCode(args: {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}): Promise<DiscordTokenResponse> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code: args.code,
		redirect_uri: args.redirectUri,
		client_id: args.clientId,
		client_secret: args.clientSecret
	});
	const r = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!r.ok) throw new Error(`discord token exchange failed: ${r.status} ${await r.text()}`);
	return responseJson<DiscordTokenResponse>(r);
}

export async function fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
	const r = await fetch('https://discord.com/api/users/@me', {
		headers: { authorization: `Bearer ${accessToken}` }
	});
	if (!r.ok) throw new Error(`discord profile fetch failed: ${r.status}`);
	return responseJson<DiscordProfile>(r);
}

export function discordAvatarUrl(profile: DiscordProfile): string | null {
	if (!profile.avatar) return null;
	const ext = profile.avatar.startsWith('a_') ? 'gif' : 'png';
	return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}`;
}

export type DiscordOAuthResult =
	| { kind: 'connect'; redirectTo: string }
	| {
			kind: 'login';
			jwtPayload: {
				sub: string;
				email: string;
				name: string;
				type: 'user';
				emailConfirmed: boolean;
				hasPassword: boolean;
				recentAuthAt: number;
			};
	  }
	| { kind: 'redirect'; redirectTo: string }
	| { kind: 'disabled'; status: 403; error: 'user_disabled' };

async function getActiveDiscordOAuthUser(db: Database, auth: JwtPayload | null) {
	if (!auth || auth.type !== 'user') return null;
	const row = await db.query.users.findFirst({
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

async function userHasPassword(db: Database, userId: string) {
	const emailIdentity = await db.query.authEmail.findFirst({
		where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.subjectId, userId)),
		columns: { id: true }
	});
	return Boolean(emailIdentity);
}

async function isDiscordEmailAlreadyUsed(db: Database, email: string) {
	const [emailIdentity, discordIdentity] = await Promise.all([
		db.query.authEmail.findFirst({
			where: and(eq(authEmail.subjectType, 'user'), eq(authEmail.email, email)),
			columns: { id: true }
		}),
		db.query.authDiscord.findFirst({
			where: and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.discordEmail, email)),
			columns: { id: true }
		})
	]);
	return Boolean(emailIdentity || discordIdentity);
}

export async function handleDiscordOAuthCallback(args: {
	db: Database;
	env: Env;
	auth: JwtPayload | null;
	code: string;
	acceptedLegal: boolean;
}): Promise<DiscordOAuthResult> {
	const tokens = await exchangeDiscordCode({
		code: args.code,
		clientId: args.env.DISCORD_CLIENT_ID,
		clientSecret: args.env.DISCORD_CLIENT_SECRET,
		redirectUri: `${args.env.PUBLIC_API_URL}/oauth/discord/callback`
	});
	const profile = await fetchDiscordProfile(tokens.access_token);

	const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
	const encryptedRefresh = await encryptToken(tokens.refresh_token, args.env.TOKEN_ENCRYPTION_KEY);

	const existing = await args.db.query.authDiscord.findFirst({
		where: and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.discordId, profile.id))
	});
	const activeUser = await getActiveDiscordOAuthUser(args.db, args.auth);

	if (activeUser) {
		if (existing && existing.subjectId !== activeUser.id) {
			return {
				kind: 'redirect',
				redirectTo: '/dashboard/settings/security?error=discord_already_connected'
			};
		}

		const connected = existing
			? existing
			: await args.db.query.authDiscord.findFirst({
					where: and(eq(authDiscord.subjectType, 'user'), eq(authDiscord.subjectId, activeUser.id))
				});

		if (connected) {
			await args.db
				.update(authDiscord)
				.set({
					discordId: profile.id,
					discordUsername: profile.username ?? null,
					discordAvatar: discordAvatarUrl(profile),
					discordEmail: profile.email ?? null,
					accessToken: tokens.access_token,
					refreshToken: encryptedRefresh,
					tokenExpiresAt: expiresAt
				})
				.where(eq(authDiscord.id, connected.id));
		} else {
			await args.db.insert(authDiscord).values({
				subjectType: 'user',
				subjectId: activeUser.id,
				discordId: profile.id,
				discordUsername: profile.username ?? null,
				discordAvatar: discordAvatarUrl(profile),
				discordEmail: profile.email ?? null,
				accessToken: tokens.access_token,
				refreshToken: encryptedRefresh,
				tokenExpiresAt: expiresAt
			});
		}

		return { kind: 'connect', redirectTo: '/dashboard/settings/security?connected=discord' };
	}

	let userPub: string;
	let username: string;
	let email: string;
	let emailVerified: boolean;
	let hasPassword = false;

	if (existing) {
		const u = await args.db.query.users.findFirst({ where: eq(users.id, existing.subjectId) });
		if (!u || u.deletedAt || u.bannedAt) {
			return { kind: 'disabled', status: 403, error: 'user_disabled' };
		}
		userPub = u.publicId;
		username = u.username;
		email = u.email ?? profile.email ?? '';
		emailVerified = u.emailVerified;
		hasPassword = await userHasPassword(args.db, u.id);
		await args.db
			.update(authDiscord)
			.set({
				discordUsername: profile.username ?? null,
				discordAvatar: discordAvatarUrl(profile),
				discordEmail: profile.email ?? null,
				accessToken: tokens.access_token,
				refreshToken: encryptedRefresh,
				tokenExpiresAt: expiresAt
			})
			.where(eq(authDiscord.id, existing.id));
	} else {
		if (!args.acceptedLegal) {
			return { kind: 'redirect', redirectTo: '/register?error=legal_acceptance_required' };
		}
		if (!profile.email || !profile.verified) {
			return { kind: 'redirect', redirectTo: '/register?error=verified_discord_email_required' };
		}
		if (await isDiscordEmailAlreadyUsed(args.db, profile.email)) {
			return { kind: 'redirect', redirectTo: '/login?error=email_already_registered' };
		}

		const userInternalId = crypto.randomUUID().replace(/-/g, '').slice(0, 21);
		userPub = publicId('user');
		username = (profile.username ?? `discord_${profile.id}`)
			.slice(0, 20)
			.replace(/[^a-zA-Z0-9_]/g, '_');
		email = profile.email ?? '';
		emailVerified = !!profile.verified;
		hasPassword = false;

		await args.db.transaction(async (tx) => {
			await tx.insert(users).values({
				id: userInternalId,
				publicId: userPub,
				username,
				displayName: profile.global_name ?? profile.username ?? null,
				avatar: discordAvatarUrl(profile),
				avatarSource: 'discord',
				email: email || null,
				emailVerified,
				termsAcceptedAt: new Date(),
				termsVersion: LEGAL_VERSIONS.terms,
				privacyVersion: LEGAL_VERSIONS.privacy,
				acceptableUseVersion: LEGAL_VERSIONS.acceptableUse
			});
			await tx.insert(authDiscord).values({
				subjectType: 'user',
				subjectId: userInternalId,
				discordId: profile.id,
				discordUsername: profile.username ?? null,
				discordAvatar: discordAvatarUrl(profile),
				discordEmail: profile.email ?? null,
				accessToken: tokens.access_token,
				refreshToken: encryptedRefresh,
				tokenExpiresAt: expiresAt
			});
		});
	}

	return {
		kind: 'login',
		jwtPayload: {
			sub: userPub,
			email,
			name: username,
			type: 'user',
			emailConfirmed: emailVerified,
			hasPassword,
			recentAuthAt: Math.floor(Date.now() / 1000)
		}
	};
}
