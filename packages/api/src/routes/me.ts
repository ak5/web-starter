import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth, requireRecentAuth } from '../middleware/auth';
import { apiBodyJsonWithSetCookie, apiNamedJson, apiResultJson } from '../lib/api-response';
import { activeAuth } from '../lib/auth-context';
import {
	deleteMeAccountResponse,
	disconnectDiscordAuth,
	meAccount,
	meSecuritySummary,
	updateMeProfile,
	uploadMeAvatarWithInput
} from '../lib/me-account';
import { avatarUploadSchema, profilePatchSchema } from '../lib/me-validation';
import type { AppContext } from '../types';

/**
 * The authenticated subject's own resource. `GET /me` returns the row;
 * `PATCH /me/profile` updates display fields; `DELETE /me` soft-deletes the
 * account (recent-auth required) and clears the JWT cookie.
 */

const meAuthRoutes = new Hono<AppContext>().delete('/discord', async (c) => {
	const result = await disconnectDiscordAuth(c.var.db, activeAuth(c));
	return apiResultJson(c, result);
});

export const meRoutes = new Hono<AppContext>()
	.use(requireAuth())
	.get('/', async (c) => {
		const result = await meAccount(c.var.db, activeAuth(c));
		return apiNamedJson(c, result, 'account');
	})
	.get('/security', async (c) => {
		const result = await meSecuritySummary(c.var.db, activeAuth(c));
		return apiNamedJson(c, result, 'security');
	})
	.route('/auth', meAuthRoutes)
	.patch('/profile', zValidator('json', profilePatchSchema), async (c) => {
		const result = await updateMeProfile(c.var.db, activeAuth(c), c.req.valid('json'));
		return apiResultJson(c, result);
	})
	.post('/avatar', zValidator('form', avatarUploadSchema), async (c) => {
		const result = await uploadMeAvatarWithInput(
			c.var.db,
			activeAuth(c),
			c.env.R2,
			c.env.PUBLIC_R2_URL,
			c.req.valid('form')
		);
		return apiResultJson(c, result);
	})
	.delete('/', requireRecentAuth(), async (c) => {
		const result = await deleteMeAccountResponse(c.var.db, c.env, activeAuth(c));
		return apiBodyJsonWithSetCookie(c, result);
	});
