/**
 * OAuth login endpoints (the removable `auth-oauth` overlay).
 *
 * Discord is the bundled login provider:
 *   GET /oauth/discord          → 302 to Discord's authorize URL with state
 *   GET /oauth/discord/callback → exchange code, upsert identity, mint JWT cookie
 *
 * Provider-specific glue (token exchange, profile fetch, refresh-token
 * encryption) lives in `lib/oauth/discord.ts`. Add a provider by adding its
 * lib + two routes here. To remove social login entirely, delete this file,
 * `lib/oauth/`, the `auth_discord` table, and the `/oauth` mount in `app.ts`.
 */
import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { handleDiscordOAuthCallbackResponse, startDiscordOAuth } from '../../lib/oauth/discord';

export const oauthRoutes = new Hono<AppContext>()
	.get('/discord', (c) => {
		return startDiscordOAuth(c);
	})
	.get('/discord/callback', async (c) => {
		return handleDiscordOAuthCallbackResponse(c);
	});
