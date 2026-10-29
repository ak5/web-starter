import type { MiddlewareHandler } from 'hono';
import { sql } from 'drizzle-orm';
import { rateLimits } from '../db/schema';
import type { AppContext } from '../types';

/** Fixed window starting at the first attempt, incremented atomically in D1. */
export interface RateLimitConfig {
	/** Logical action name, e.g. 'login' / 'register'. */
	key: string;
	/** Account limits must follow requireAuth; public endpoints default to IP. */
	scope?: 'account';
	/** Cap within `windowSeconds`. */
	maxAttempts: number;
	/** Window length in seconds. */
	windowSeconds: number;
}

export const rateLimit =
	(config: RateLimitConfig): MiddlewareHandler<AppContext> =>
	async (c, next) => {
		const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
		const auth = c.var.auth;
		if (config.scope === 'account' && !auth) return c.json({ error: 'unauthorized' }, 401);
		const identity = config.scope === 'account' ? `${auth!.type}:${auth!.sub}` : `ip:${ip}`;
		const now = Date.now();
		const expiresAt = new Date(now + config.windowSeconds * 1000);
		const [accepted] = await c.var.db
			.insert(rateLimits)
			.values({ key: `${config.key}:${identity}`, attempts: 1, expiresAt })
			.onConflictDoUpdate({
				target: rateLimits.key,
				set: {
					attempts: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN 1 ELSE ${rateLimits.attempts} + 1 END`,
					expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${expiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`
				},
				setWhere: sql`${rateLimits.expiresAt} <= ${now} OR ${rateLimits.attempts} < ${config.maxAttempts}`
			})
			.returning({ key: rateLimits.key });
		if (!accepted) {
			c.header('Retry-After', String(config.windowSeconds));
			return c.json({ error: 'rate_limited', retryAfter: config.windowSeconds }, 429);
		}
		await next();
	};
