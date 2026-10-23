import { and, count, desc, eq } from 'drizzle-orm';
import type { Database } from '../db';
import { auditLog } from '../db/schema';
import { displayDateTime, displayJsonPayload } from './admin-display';
import { auditLogActionOptions } from './admin-validation';
import { optionalQueryFilter, queryLimit, queryOffsetPage } from './request-parsing';

type AdminAuditLogQuery = {
	limit?: string;
	page?: string;
	action?: string;
	entityType?: string;
	entityId?: string;
};

export async function adminAuditLog(db: Database, query: AdminAuditLogQuery) {
	const limit = queryLimit(query.limit, 50, 100);
	const page = queryOffsetPage(query.page);
	const action = optionalQueryFilter(query.action, 128);
	const entityType = optionalQueryFilter(query.entityType, 64);
	const entityId = optionalQueryFilter(query.entityId, 24);
	const where = and(
		action ? eq(auditLog.action, action) : undefined,
		entityType ? eq(auditLog.entityType, entityType) : undefined,
		entityId ? eq(auditLog.entityId, entityId) : undefined
	);
	const [rows, total] = await Promise.all([
		db.query.auditLog.findMany({
			where,
			orderBy: [desc(auditLog.createdAt)],
			limit,
			offset: page * limit,
			with: { admin: true }
		}),
		db.select({ count: count() }).from(auditLog).where(where)
	]);

	return {
		entries: rows.map((entry) => ({
			id: entry.id,
			action: entry.action,
			entityType: entry.entityType,
			entityId: entry.entityId,
			payload: entry.payload,
			payloadJson: displayJsonPayload(entry.payload ?? {}),
			createdAt: entry.createdAt,
			createdLabel: displayDateTime(entry.createdAt),
			admin: entry.admin
				? {
						publicId: entry.admin.publicId,
						username: entry.admin.username,
						email: entry.admin.email
					}
				: null
		})),
		page,
		limit,
		total: total[0]?.count ?? 0,
		filters: { action, entityType, entityId },
		filterOptions: {
			actions: auditLogActionOptions
		}
	};
}
