import { asc, eq, lte, lt } from 'drizzle-orm';
import type { Database } from '../db';
import { attachmentCleanup, rateLimits, tokens } from '../db/schema';
import type { Logger } from '../lib/logger';

export interface JobDeps {
	db: Database;
	logger: Logger;
	privateAttachments?: R2Bucket;
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

export async function purgePrivateAttachments({ db, logger, privateAttachments }: JobDeps) {
	if (!privateAttachments) return;
	const due = await db
		.select()
		.from(attachmentCleanup)
		.where(lte(attachmentCleanup.after, new Date()))
		.orderBy(asc(attachmentCleanup.after))
		.limit(50);
	let failures = 0;
	for (const { objectKey } of due) {
		try {
			await privateAttachments.delete(objectKey);
			await db.delete(attachmentCleanup).where(eq(attachmentCleanup.objectKey, objectKey));
		} catch {
			failures++;
			await db
				.update(attachmentCleanup)
				.set({ after: new Date(Date.now() + 60 * 60 * 1000) })
				.where(eq(attachmentCleanup.objectKey, objectKey));
		}
	}
	if (failures) logger.log('warn', 'private attachment cleanup will retry', { failures });
}

/**
 * Dispatch scheduled jobs by cron expression. Add `if (cron === '…')` branches
 * for additional jobs; keep repeated and concurrent runs safe with atomic writes.
 */
export async function runAllCronJobs(cron: string, deps: JobDeps): Promise<void> {
	await purgeExpiredTokens(deps);
	await purgeExpiredRateLimits(deps);
	await purgePrivateAttachments(deps);
	deps.logger.log('info', 'cron tick complete', { cron });
}
