import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import type { AppContext } from '../types';
import { verifyJwt } from '../lib/jwt';
import { db } from '../db';
import { adminUsers, users } from '../db/schema';
import { COOKIE_TOKEN, isRecentAuth, parseCookie } from '@ak5/shared';
import { isActiveImpersonator } from '../lib/auth-subject';

/** Populate `c.var.db` for every request. */
export const withDb = (): MiddlewareHandler<AppContext> => async (c, next) => {
	c.set('db', db(c.env.DB));
	await next();
};

/**
 * Read the JWT cookie, verify it, and stash the payload on `c.var.auth`.
 * Always passes through (auth=null when missing/invalid). Routes that require
 * auth use `requireAuth` below.
 */
export const withAuth = (): MiddlewareHandler<AppContext> => async (c, next) => {
	const token = parseCookie(c.req.header('cookie'), COOKIE_TOKEN);
	const payload = token ? await verifyJwt(c.env.JWT_SECRET, token) : null;
	c.set('auth', payload && (await isActiveImpersonator(c.var.db, payload)) ? payload : null);
	await next();
};

/** Route-level guard: 401 if no JWT, optionally restrict to a role type. */
export const requireAuth =
	(type?: 'user' | 'admin'): MiddlewareHandler<AppContext> =>
	async (c, next) => {
		const auth = c.var.auth;
		if (!auth) return c.json({ error: 'unauthorized' }, 401);
		if (type && auth.type !== type) return c.json({ error: 'forbidden' }, 403);
		if (auth.type === 'user') {
			const row = await c.var.db.query.users.findFirst({
				where: eq(users.publicId, auth.sub),
				columns: { deletedAt: true, bannedAt: true }
			});
			if (!row || row.deletedAt) return c.json({ error: 'unauthorized' }, 401);
			if (row.bannedAt && !auth.impersonatedBy) return c.json({ error: 'user_disabled' }, 403);
		}
		if (auth.type === 'admin') {
			const row = await c.var.db.query.adminUsers.findFirst({
				where: eq(adminUsers.publicId, auth.sub),
				columns: { deletedAt: true }
			});
			if (!row || row.deletedAt) return c.json({ error: 'unauthorized' }, 401);
		}
		await next();
	};

/**
 * Sensitive-action guard: requires `recentAuthAt` within 15 minutes. Used for
 * change-password, email-change, account-deletion. Returns a structured 403
 * the frontend can recognize and surface a re-auth banner for.
 */
export const requireRecentAuth = (): MiddlewareHandler<AppContext> => async (c, next) => {
	const auth = c.var.auth;
	if (!auth) return c.json({ error: 'unauthorized' }, 401);
	if (!isRecentAuth(auth)) {
		return c.json({ error: 'recent_auth_required', code: 'recent_auth_required' }, 403);
	}
	await next();
};
