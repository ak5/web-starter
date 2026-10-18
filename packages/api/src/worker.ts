import { app } from './app';
import { runAllCronJobs, type JobDeps } from './cron/jobs';
import { db as makeDb } from './db';
import { Logger } from './lib/logger';
import type { Env } from './types';

type CronRunner = (cron: string, deps: JobDeps) => Promise<void>;

type ScheduledCronDeps = {
	makeDb?: typeof makeDb;
	makeLogger?: (env: Env, ctx: ExecutionContext) => Logger;
	runAllCronJobs?: CronRunner;
};

export function runScheduledCron(
	controller: Pick<ScheduledController, 'cron'>,
	env: Env,
	ctx: ExecutionContext,
	deps: ScheduledCronDeps = {}
): void {
	const runner = deps.runAllCronJobs ?? runAllCronJobs;
	const db = (deps.makeDb ?? makeDb)(env.DB);
	const logger = deps.makeLogger?.(env, ctx) ?? new Logger(env.DISCORD_LOG_ENDPOINT, ctx);
	ctx.waitUntil(runner(controller.cron, { db, kv: env.KV, logger }));
}

export default {
	async fetch(req, env, ctx): Promise<Response> {
		return app.fetch(req, env, ctx);
	},

	async scheduled(controller, env, ctx): Promise<void> {
		runScheduledCron(controller, env, ctx);
	}
} satisfies ExportedHandler<Env>;
