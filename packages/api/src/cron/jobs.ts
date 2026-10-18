import { lt } from 'drizzle-orm';
import type { Database } from '../db';
import { tokens } from '../db/schema';
import type { Logger } from '../lib/logger';

export interface JobDeps {
	db: Database;
	kv: KVNamespace;
	logger: Logger;
}

/**
 * Delete expired one-time tokens (verify-email / reset-password / magic-login).
 * Idempotent — safe to run on every scheduled tick.
 */
export async function purgeExpiredTokens(deps: JobDeps): Promise<void> {
	await deps.db.delete(tokens).where(lt(tokens.expiresAt, new Date()));
}

/**
 * Dispatch scheduled jobs by cron expression. Add `if (cron === '…')` branches
 * for additional jobs; keep each job idempotent and guard shared work with a KV
 * lock (see `KV_LOCKS` in `@ak5/shared`).
 */
export async function runAllCronJobs(cron: string, deps: JobDeps): Promise<void> {
	await purgeExpiredTokens(deps);
	deps.logger.log('info', 'cron tick complete', { cron });
}
