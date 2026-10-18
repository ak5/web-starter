import { Hono } from 'hono';
import { apiBodyJson } from '../lib/api-response';
import { publicUserProfileResponse } from '../lib/users-profile';
import type { AppContext } from '../types';

/**
 * Public profile read by username. No auth required — anyone can browse a
 * public profile. Returns the user's public display fields, never internal IDs.
 */

export const usersRoutes = new Hono<AppContext>().get('/:username', async (c) => {
	const username = c.req.param('username');
	const result = await publicUserProfileResponse(c.var.db, username);
	return apiBodyJson(c, result);
});
