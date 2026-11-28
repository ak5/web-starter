import { lt } from 'drizzle-orm';
import type { Database } from '../db';
import { rateLimits, tokens } from '../db/schema';
import type { Logger } from '../lib/logger';

export interface JobDeps {
	db: Database;
	logger: Logger;
}

/**
 * Delete expired one-time tokens (verify-email / reset-password / magic-login).
 * Idempotent — safe to run on every scheduled tick.
 */
export async function purgeExpiredTokens(deps: JobDeps): Promise<void> {
	await deps.db.delete(tokens).where(lt(tokens.expiresAt, new Date()));
}

export async function purgeExpiredRateLimits(deps: JobDeps): Promise<void> {
	await deps.db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
}

/**
 * Dispatch scheduled jobs by cron expression. Add `if (cron === '…')` branches
 * for additional jobs; keep repeated and concurrent runs safe with atomic writes.
 */
export async function runAllCronJobs(cron: string, deps: JobDeps): Promise<void> {
	await purgeExpiredTokens(deps);
	await purgeExpiredRateLimits(deps);
	deps.logger.log('info', 'cron tick complete', { cron });
}
