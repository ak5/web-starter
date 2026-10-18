/**
 * Hono app composition. Defines two scoped sub-routers — `webApi` and
 * `adminApi` — and exports their types for end-to-end RPC typing in
 * `packages/web` and `packages/admin`.
 *
 * The trick: each scoped router only mounts the routes that frontend should be
 * able to call. Importing `hc<AdminApiType>` from the user frontend, then
 * calling `client.admin.users.$get()`, is a compile error. Add a persona by
 * exporting another scoped router + `*ApiType` (see docs/development).
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext } from './types';
import { withAuth, withDb } from './middleware/auth';
import { userPreAuth, adminPreAuth, inviteAuth, postAuth } from './routes/auth/index';
import { meRoutes } from './routes/me';
import { usersRoutes } from './routes/users';
import { itemsRoutes } from './routes/items';
import { adminRoutes } from './routes/admin';
import { oauthRoutes } from './routes/oauth/index';

function createBaseApp() {
	return new Hono<AppContext>()
		.use(
			'*',
			cors({
				origin: (origin, c) => {
					const allowed = [c.env.PUBLIC_APP_URL, c.env.PUBLIC_ADMIN_URL];
					return allowed.includes(origin) ? origin : '';
				},
				credentials: true,
				allowHeaders: ['content-type', 'authorization'],
				allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
			})
		)
		.use('*', withDb())
		.use('*', withAuth())
		.get('/healthz', (c) => c.json({ ok: true }));
}

// ============================================================================
// Web (public app) scoped router
// ============================================================================

export const webApi = createBaseApp()
	.route('/auth', userPreAuth)
	.route('/auth', inviteAuth)
	.route('/auth', postAuth)
	.route('/oauth', oauthRoutes)
	.route('/me', meRoutes)
	.route('/users', usersRoutes)
	.route('/items', itemsRoutes);

// ============================================================================
// Admin scoped router
// ============================================================================

export const adminApi = createBaseApp()
	.route('/auth', adminPreAuth)
	.route('/auth', inviteAuth)
	.route('/auth', postAuth)
	.route('/me', meRoutes)
	.route('/admin', adminRoutes);

// ============================================================================
// Combined router served by the worker. Each frontend talks to the same worker
// but only types its client against the appropriate scoped export above.
// ============================================================================

export const app = createBaseApp()
	.route('/auth', userPreAuth)
	.route('/auth', adminPreAuth)
	.route('/auth', inviteAuth)
	.route('/auth', postAuth)
	.route('/oauth', oauthRoutes)
	.route('/me', meRoutes)
	.route('/users', usersRoutes)
	.route('/items', itemsRoutes)
	.route('/admin', adminRoutes);

// Exported types — consumed by `hc<WebApiType>` / `hc<AdminApiType>` in frontends.
export type WebApiType = typeof webApi;
export type AdminApiType = typeof adminApi;
