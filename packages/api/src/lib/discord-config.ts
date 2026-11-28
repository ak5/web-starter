import type { Env } from '../types';

export function isDiscordConfigured(env: Env) {
	return Boolean(env.DISCORD_CLIENT_ID?.trim() && env.DISCORD_CLIENT_SECRET?.trim());
}
