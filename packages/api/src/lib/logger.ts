import type { EmailLogger } from '@ak5/email';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Lightweight worker-side logger. Mirrors the legacy `Logger` class in
 * `packages/web/src/lib/server/log.ts`: stdout for local dev, Discord webhook
 * for prod errors, optional async DB write (later — using `logs` table).
 */
export class Logger implements EmailLogger {
	constructor(
		private readonly discordWebhook: string | undefined,
		private readonly ctx: ExecutionContext | undefined
	) {}

	log(level: LogLevel, message: string, data?: Record<string, unknown>) {
		const entry = { level, message, data, ts: new Date().toISOString() };
		console.log(JSON.stringify(entry));
		if (level === 'error' && this.discordWebhook) {
			const payload = {
				embeds: [
					{
						title: `[${level}] ${message}`,
						description: data
							? '```\n' + JSON.stringify(data, null, 2).slice(0, 1800) + '\n```'
							: undefined,
						color: 0xff4d4f
					}
				]
			};
			const promise = fetch(this.discordWebhook, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			}).catch(() => {});
			this.ctx?.waitUntil(promise);
		}
	}
}
