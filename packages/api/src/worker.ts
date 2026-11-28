import { handleMcp, isMcpPath } from './mcp';
import { app } from './app';
import { syncRequest } from './sync';
export { NotesSync } from './sync';
import { runAllCronJobs } from './cron/jobs';
import { db as makeDb } from './db';
import { Logger } from './lib/logger';
import type { Env } from './types';

export default {
	async fetch(req, env, ctx): Promise<Response> {
		const { pathname } = new URL(req.url);
		if (isMcpPath(pathname)) return handleMcp(req, env, ctx);
		if (pathname.replace(/\/$/, '') === '/sync') return syncRequest(req, env, ctx);
		return app.fetch(req, env, ctx);
	},

	async scheduled(controller, env, ctx): Promise<void> {
		const db = makeDb(env.DB);
		const logger = new Logger(env.DISCORD_LOG_ENDPOINT, ctx);
		ctx.waitUntil(
			runAllCronJobs(controller.cron, { db, logger, privateAttachments: env.PRIVATE_ATTACHMENTS })
		);
	}
} satisfies ExportedHandler<Env>;
