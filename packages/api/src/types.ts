import type { EmailSendBinding } from '@ak5/email';
import type { JwtPayload } from '@ak5/shared';
import type { Database } from './db';

/** Cloudflare bindings + secrets visible to the worker. */
export interface Env {
	// Bindings
	DB: D1Database;
	NOTES_SYNC: DurableObjectNamespace;
	R2: R2Bucket;
	KV: KVNamespace;

	// Public/shared vars
	PUBLIC_API_URL: string;
	PUBLIC_APP_URL: string;
	PUBLIC_ADMIN_URL: string;
	PUBLIC_EMAIL_FROM: string;
	PUBLIC_R2_URL: string;
	COOKIE_ORIGIN: string;

	// Email Sending binding in deployed environments; local mock in dev/test.
	EMAIL?: EmailSendBinding;
	EMAIL_MOCK_URL?: string;

	// Secrets
	JWT_SECRET: string;
	TOKEN_ENCRYPTION_KEY: string;

	// Cloudflare API — used by admin infrastructure status panels (optional)
	CLOUDFLARE_API_TOKEN?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;

	// OAuth login (Discord) — part of the removable auth-oauth overlay
	DISCORD_CLIENT_ID: string;
	DISCORD_CLIENT_SECRET: string;

	// Optional structured-log webhook sink
	DISCORD_LOG_ENDPOINT?: string;
}

/** Hono request-scoped context — populated by middleware. */
export interface AppContext {
	Bindings: Env;
	Variables: {
		db: Database;
		auth: JwtPayload | null;
	};
}
