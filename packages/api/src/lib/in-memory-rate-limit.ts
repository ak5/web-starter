/**
 * In-memory rate limiter for CF Workers. State persists within an isolate but
 * not across colos — acceptable for the narrow case it's built for: bounding
 * accidental double-clicks and shell loops on /dev/* tooling endpoints, where
 * the true safety guarantee comes from the resource-level guard (see
 * `isProtectedBranch` in `lib/neon.ts`), not from this limiter.
 *
 * For request-shaped rate limiting against motivated abusers, use the
 * KV-backed `middleware/rate-limit.ts` instead.
 */

interface Entry {
	count: number;
	resetAt: number;
}

export function createRateLimiter(windowMs: number, maxAttempts: number) {
	const store = new Map<string, Entry>();

	function cleanup() {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (entry.resetAt < now) store.delete(key);
		}
	}

	return {
		check(key: string): boolean {
			cleanup();
			const entry = store.get(key);
			if (!entry) return true;
			return entry.count < maxAttempts;
		},
		increment(key: string) {
			const now = Date.now();
			const entry = store.get(key);
			if (entry && entry.resetAt > now) {
				entry.count++;
			} else {
				store.set(key, { count: 1, resetAt: now + windowMs });
			}
		},
		reset(key: string) {
			store.delete(key);
		}
	};
}
