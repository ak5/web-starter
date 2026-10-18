import { count, desc } from 'drizzle-orm';

import type { Database } from '../db';
import { logs } from '../db/schema';
import { displayDateTime, displayJsonPayload } from './admin-display';
import { queryLimit, queryOffsetPage } from './request-parsing';

export type AdminLogListQuery = {
	limit?: string;
	page?: string;
};

function logMessageLabel(data: unknown) {
	if (data && typeof data === 'object' && 'message' in data) {
		return String((data as { message?: unknown }).message ?? '(no message)');
	}
	return '(no message)';
}

export async function adminLogList(db: Database, query: AdminLogListQuery) {
	const limit = queryLimit(query.limit, 50, 100);
	const page = queryOffsetPage(query.page);
	const [rows, total] = await Promise.all([
		db.query.logs.findMany({
			orderBy: [desc(logs.timestamp)],
			limit,
			offset: page * limit
		}),
		db.select({ count: count() }).from(logs)
	]);

	return {
		logs: rows.map((log) => ({
			id: log.id,
			timestamp: log.timestamp,
			timestampLabel: displayDateTime(log.timestamp),
			messageLabel: logMessageLabel(log.data),
			level: log.level,
			context: log.context,
			data: log.data,
			detailJson: displayJsonPayload({ context: log.context, data: log.data })
		})),
		page,
		limit,
		total: total[0]?.count ?? 0
	};
}
