import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getPaginationParams } from '@ak5/shared';
import { requireAuth } from '../middleware/auth';
import { listAllItems } from '../lib/items';
import { apiBodyJson, apiBodyJsonWithSetCookies, apiResultJson } from '../lib/api-response';
import { activeAuth, activeAuthSub } from '../lib/auth-context';
import { adminAuditLog } from '../lib/admin-audit-log';
import { adminHealthReport } from '../lib/admin-health';
import { adminLogList } from '../lib/admin-logs';
import { adminTokenDiagnosticsResponse } from '../lib/admin-token-diagnostics';
import {
	adminBanUser,
	adminCreateAccount,
	adminDeleteUser,
	adminInviteAccount,
	adminStartImpersonationSessionForTarget,
	adminUnbanUser,
	adminUserList
} from '../lib/admin-users';
import { adminCloudflareIntegration, adminLocalIntegration } from '../lib/admin-system';
import {
	adminCreateUserSchema,
	adminInviteSchema,
	adminLogQuerySchema,
	adminTokenEmailParamSchema,
	auditLogQuerySchema
} from '../lib/admin-validation';
import type { AppContext } from '../types';

export const adminRoutes = new Hono<AppContext>()
	.use(requireAuth('admin'))
	.get('/health', async (c) => c.json(await adminHealthReport(c.var.db)))
	.get('/integrations/cloudflare', async (c) => c.json(await adminCloudflareIntegration(c.env)))
	.get('/integrations/local', async (c) => c.json(await adminLocalIntegration(c.env)))
	.get('/logs', zValidator('query', adminLogQuerySchema), async (c) => {
		return c.json(await adminLogList(c.var.db, c.req.valid('query')));
	})
	.get('/audit-log', zValidator('query', auditLogQuerySchema), async (c) => {
		return c.json(await adminAuditLog(c.var.db, c.req.valid('query')));
	})
	.get('/tokens/:email', zValidator('param', adminTokenEmailParamSchema), async (c) => {
		const { email } = c.req.valid('param');
		const result = await adminTokenDiagnosticsResponse(c.var.db, c.env, email);
		return apiBodyJson(c, result);
	})
	.post('/invite', zValidator('json', adminInviteSchema), async (c) => {
		const result = await adminInviteAccount(c.var.db, c.env, activeAuthSub(c), c.req.valid('json'));
		return apiResultJson(c, result, 201);
	})
	.get('/items', async (c) => {
		const { page, offset, limit } = getPaginationParams(new URL(c.req.url));
		return c.json(await listAllItems(c.var.db, page, offset, limit));
	})
	.get('/users', async (c) => c.json(await adminUserList(c.var.db)))
	.post('/users', zValidator('json', adminCreateUserSchema), async (c) => {
		const result = await adminCreateAccount(c.var.db, c.req.valid('json'));
		return apiResultJson(c, result, 201);
	})
	.delete('/users/:publicId', async (c) => {
		const result = await adminDeleteUser(c.var.db, activeAuthSub(c), c.req.param('publicId'));
		return apiResultJson(c, result);
	})
	.post('/impersonate/:publicId', async (c) => {
		const result = await adminStartImpersonationSessionForTarget(
			c.var.db,
			c.env,
			activeAuth(c),
			c.req.param('publicId'),
			c.req.header('cookie') ?? null
		);
		return apiBodyJsonWithSetCookies(c, result);
	})
	.post('/users/:publicId/ban', async (c) => {
		const result = await adminBanUser(c.var.db, activeAuthSub(c), c.req.param('publicId'));
		return apiResultJson(c, result);
	})
	.post('/users/:publicId/unban', async (c) => {
		const result = await adminUnbanUser(c.var.db, activeAuthSub(c), c.req.param('publicId'));
		return apiResultJson(c, result);
	});
