import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getPaginationParams } from '@ak5/shared';
import { requireAuth } from '../middleware/auth';
import { apiResultJson } from '../lib/api-response';
import { activeAuth } from '../lib/auth-context';
import { createItem, deleteItem, getItem, listItems, updateItem } from '../lib/items';
import { itemCreateSchema, itemUpdateSchema } from '../lib/items-validation';
import type { AppContext } from '../types';

/**
 * Example CRUD resource — the authenticated user's own `items`. Every route is
 * user-scoped via `requireAuth('user')` + ownership checks in the lib, and
 * addresses rows by their public id (`i-…`). This is the demo the native mobile app
 * drives; replace it with your real domain routes.
 */
export const itemsRoutes = new Hono<AppContext>()
	.use(requireAuth('user'))
	.get('/', async (c) => {
		const { page, offset, limit } = getPaginationParams(new URL(c.req.url));
		const result = await listItems(c.var.db, activeAuth(c), page, offset, limit);
		return apiResultJson(c, result);
	})
	.get('/:id', async (c) => {
		const result = await getItem(c.var.db, activeAuth(c), c.req.param('id'));
		return apiResultJson(c, result);
	})
	.post('/', zValidator('json', itemCreateSchema), async (c) => {
		const result = await createItem(c.var.db, activeAuth(c), c.req.valid('json'));
		return apiResultJson(c, result, 201);
	})
	.patch('/:id', zValidator('json', itemUpdateSchema), async (c) => {
		const result = await updateItem(
			c.var.db,
			activeAuth(c),
			c.req.param('id'),
			c.req.valid('json')
		);
		return apiResultJson(c, result);
	})
	.delete('/:id', async (c) => {
		const result = await deleteItem(c.var.db, activeAuth(c), c.req.param('id'));
		return apiResultJson(c, result);
	});
