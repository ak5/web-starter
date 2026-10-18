import { Hono } from 'hono';
import { resetDevBranchByEndpoint } from '../../lib/dev-db-branches';
import type { AppContext } from '../../types';

// ---------------------------------------------------------------------------
// POST /dev/db-branches/:endpointId/reset — unauthenticated
// ---------------------------------------------------------------------------
// Hono adapter for collaborator dev database resets. The capability model,
// safety policy, provider calls, and response DTO live in the API lib.
// ---------------------------------------------------------------------------

export const dbBranchRoutes = new Hono<AppContext>().post('/:endpointId/reset', async (c) => {
	return c.json(await resetDevBranchByEndpoint(c.env, c.req.param('endpointId')));
});
