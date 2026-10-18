import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import type { AppContext } from '../types';
import { verifyJwt } from '../lib/jwt';
import { db } from '../db';
import { adminUsers, users } from '../db/schema';
import { COOKIE_TOKEN } from '@ak5/shared';

const FIFTEEN_MIN_S = 15 * 60;

/** Populate `c.var.db` for every request. */
export const withDb = (): MiddlewareHandler<AppContext> => async (c, next) => {
	c.set('db', db(c.env.DATABASE_URL));
	await next();
};

/**
 * Read the JWT cookie, verify it, and stash the payload on `c.var.auth`.
 * Always passes through (auth=null when missing/invalid). Routes that require
 * auth use `requireAuth` below.
 */
export const withAuth = (): MiddlewareHandler<AppContext> => async (c, next) => {
	const cookie = c.req.header('cookie') ?? '';
	const m = new RegExp(`(?:^|;\\s*)${COOKIE_TOKEN}=([^;]+)`).exec(cookie);
	if (!m) {
		c.set('auth', null);
		await next();
		return;
	}
	const payload = await verifyJwt(c.env.JWT_SECRET, decodeURIComponent(m[1]));
	c.set('auth', payload);
	await next();
};

/** Route-level guard: 401 if no JWT, optionally restrict to a role type. */
export const requireAuth =
	(type?: 'user' | 'admin'): MiddlewareHandler<AppContext> =>
	async (c, next) => {
		const auth = c.var.auth;
		if (!auth) return c.json({ error: 'unauthorized' }, 401);
		if (type && auth.type !== type) return c.json({ error: 'forbidden' }, 403);
		if (type === 'user') {
			const row = await c.var.db.query.users.findFirst({
				where: eq(users.publicId, auth.sub),
				columns: { deletedAt: true, bannedAt: true }
			});
			if (!row || row.deletedAt) return c.json({ error: 'unauthorized' }, 401);
			if (row.bannedAt && !auth.impersonatedBy) return c.json({ error: 'user_disabled' }, 403);
		}
		if (type === 'admin') {
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
	const now = Math.floor(Date.now() / 1000);
	if (now - auth.recentAuthAt > FIFTEEN_MIN_S) {
		return c.json({ error: 'recent_auth_required', code: 'recent_auth_required' }, 403);
	}
	await next();
};
