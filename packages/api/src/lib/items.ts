import { and, desc, eq } from 'drizzle-orm';
import { getPaginationMeta, type JwtPayload } from '@ak5/shared';

import type { Database } from '../db';
import { items, type Item } from '../db/schema';
import { getActiveUserByAuth } from './auth-subject';
import { publicId } from './public-id';
import type { ItemCreate, ItemUpdate } from './items-validation';

/**
 * Business logic for the example `items` resource — a generic per-user record
 * with a free-form `data` jsonb payload. Every operation is scoped to the
 * authenticated user; rows are addressed by their `public_id` (`i-…`), and the
 * internal PK / `user_id` are never exposed. This is the demo CRUD the native mobile
 * app drives; replace it with your real domain logic.
 */

/** The shape clients see — public id only, timestamps as ISO strings. */
function toItemDto(row: Item) {
	return {
		id: row.publicId,
		data: row.data,
		createdAt: row.createdAt.toISOString(),
		modifiedAt: row.modifiedAt.toISOString()
	};
}

export type ItemDto = ReturnType<typeof toItemDto>;

export async function listItems(
	db: Database,
	auth: JwtPayload,
	page: number,
	offset: number,
	limit: number
) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}
	const userId = activeUser.user.id;

	const [rows, total] = await Promise.all([
		db.query.items.findMany({
			where: eq(items.userId, userId),
			orderBy: [desc(items.createdAt)],
			limit,
			offset
		}),
		db.$count(items, eq(items.userId, userId))
	]);

	return {
		ok: true as const,
		result: {
			items: rows.map(toItemDto),
			pagination: getPaginationMeta(total, page, limit)
		}
	};
}

/**
 * Admin oversight: list every user's items (no per-user scoping), each with its
 * owner's username. Backs the admin `/admin/items` read-only view; the same
 * shared ItemsTable renders this and the per-user list above.
 */
export async function listAllItems(db: Database, page: number, offset: number, limit: number) {
	const [rows, total] = await Promise.all([
		db.query.items.findMany({
			orderBy: [desc(items.createdAt)],
			limit,
			offset,
			with: { user: { columns: { username: true } } }
		}),
		db.$count(items)
	]);

	return {
		items: rows.map((row) => ({ ...toItemDto(row), owner: row.user?.username ?? null })),
		pagination: getPaginationMeta(total, page, limit)
	};
}

export async function getItem(db: Database, auth: JwtPayload, itemPublicId: string) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}

	const row = await db.query.items.findFirst({
		where: and(eq(items.publicId, itemPublicId), eq(items.userId, activeUser.user.id))
	});
	if (!row) return { ok: false as const, error: 'not_found' as const, status: 404 as const };

	return { ok: true as const, result: toItemDto(row) };
}

export async function createItem(db: Database, auth: JwtPayload, input: ItemCreate) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}

	const [row] = await db
		.insert(items)
		.values({
			publicId: publicId('item'),
			userId: activeUser.user.id,
			data: input.data
		})
		.returning();

	return { ok: true as const, result: toItemDto(row) };
}

export async function updateItem(
	db: Database,
	auth: JwtPayload,
	itemPublicId: string,
	input: ItemUpdate
) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}

	const [row] = await db
		.update(items)
		.set({ data: input.data, modifiedAt: new Date() })
		.where(and(eq(items.publicId, itemPublicId), eq(items.userId, activeUser.user.id)))
		.returning();
	if (!row) return { ok: false as const, error: 'not_found' as const, status: 404 as const };

	return { ok: true as const, result: toItemDto(row) };
}

export async function deleteItem(db: Database, auth: JwtPayload, itemPublicId: string) {
	const activeUser = await getActiveUserByAuth(db, auth);
	if ('error' in activeUser) {
		return { ok: false as const, error: activeUser.error, status: activeUser.status };
	}

	const deleted = await db
		.delete(items)
		.where(and(eq(items.publicId, itemPublicId), eq(items.userId, activeUser.user.id)))
		.returning({ id: items.id });
	if (deleted.length === 0) {
		return { ok: false as const, error: 'not_found' as const, status: 404 as const };
	}

	return { ok: true as const, result: { ok: true } };
}
