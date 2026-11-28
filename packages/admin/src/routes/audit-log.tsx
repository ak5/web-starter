import { Form } from 'react-router';
import Pagination from '@ak5/webui/components/Pagination';
import { loadAuditLog } from '../lib/audit-log.server';
import type { Route } from './+types/audit-log';

export const loader = loadAuditLog;
export const headers = () => ({ 'Cache-Control': 'no-store' });

export default function AuditLog({ loaderData }: Route.ComponentProps) {
	const { entries, filters, actions, pagination } = loaderData;
	return (
		<section className="mx-auto max-w-5xl p-6">
			<h1 className="mb-4 text-2xl font-bold">Audit Log</h1>
			<Form
				method="get"
				className="mb-4 flex flex-wrap items-end gap-3"
				key={JSON.stringify(filters)}
			>
				<label className="grid gap-1">
					Action
					<select name="action" className="ui-field" defaultValue={filters.action ?? ''}>
						<option value="">All actions</option>
						{actions.map((action) => (
							<option key={action}>{action}</option>
						))}
					</select>
				</label>
				<label className="grid gap-1">
					Record type
					<input name="entityType" className="ui-field" defaultValue={filters.entityType ?? ''} />
				</label>
				<label className="grid gap-1">
					Record ID
					<input name="entityId" className="ui-field" defaultValue={filters.entityId ?? ''} />
				</label>
				<button className="ui-button" type="submit">
					Filter
				</button>
			</Form>
			{entries.length ? (
				<div className="overflow-x-auto">
					<table className="ui-table w-full">
						<thead>
							<tr>
								<th scope="col">Time</th>
								<th scope="col">Administrator</th>
								<th scope="col">Action</th>
								<th scope="col">Record</th>
							</tr>
						</thead>
						<tbody>
							{entries.map((entry, index) => (
								<tr key={index}>
									<td>{entry.createdLabel}</td>
									<td>{entry.administrator}</td>
									<td>{entry.action}</td>
									<td>
										{entry.entityType} {entry.entityId}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p>No audit entries found.</p>
			)}
			<Pagination pagination={pagination} />
		</section>
	);
}
