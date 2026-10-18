import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../types';

/**
 * Simple sliding-window rate limit backed by Cloudflare KV. Mirrors the
 * legacy `packages/web/src/lib/server/rate-limit.ts` semantics: track the
 * count of attempts per key in a TTL'd KV entry, return 429 once over the cap.
 *
 * The key includes the IP (CF-Connecting-IP) plus the route name so different
 * endpoints don't share buckets.
 */
export interface RateLimitConfig {
	/** Logical name used in the KV key. e.g. 'login' / 'register'. */
	key: string;
	/** Cap within `windowSeconds`. */
	maxAttempts: number;
	/** Window length in seconds. */
	windowSeconds: number;
}

export const rateLimit =
	(config: RateLimitConfig): MiddlewareHandler<AppContext> =>
	async (c, next) => {
		const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
		const kvKey = `ratelimit:${config.key}:${ip}`;
		const raw = await c.env.KV.get(kvKey);
		const count = raw ? parseInt(raw, 10) : 0;
		if (count >= config.maxAttempts) {
			return c.json({ error: 'rate_limited', retryAfter: config.windowSeconds }, 429);
		}
		await c.env.KV.put(kvKey, String(count + 1), { expirationTtl: config.windowSeconds });
		await next();
	};
