import { data, redirect } from 'react-router';
import { apiLoadJson, type ApiRequestEvent } from '@ak5/webui/server';
import { api } from './api.server';

export async function loadAuditLog(event: ApiRequestEvent) {
	const url = new URL(event.request.url);
	const search = url.searchParams;
	const result = await apiLoadJson(
		await api(event).admin['audit-log'].$get({
			query: {
				action: search.get('action') ?? undefined,
				entityType: search.get('entityType') ?? undefined,
				entityId: search.get('entityId') ?? undefined,
				page: search.get('page') ?? undefined
			}
		}),
		'Could not load the audit log. Please retry.'
	);
	if (!('total' in result)) throw new Response('Invalid audit log response', { status: 502 });
	const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
	if (result.page >= totalPages) {
		search.set('page', String(totalPages - 1));
		throw redirect(url.pathname + url.search);
	}
	return data(
		{
			entries: result.entries.map(({ action, entityType, entityId, createdLabel, admin }) => ({
				action,
				entityType,
				entityId,
				createdLabel,
				administrator: admin?.username ?? '—'
			})),
			filters: result.filters,
			actions: result.filterOptions.actions,
			pagination: {
				page: result.page,
				total: result.total,
				totalPages,
				hasPrev: result.page > 0,
				hasNext: result.page + 1 < totalPages
			}
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
