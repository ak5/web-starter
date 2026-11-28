import type { ReactNode } from 'react';

type ItemRow = {
	id: string;
	data: unknown;
	createdAt: string;
	owner?: string | null;
};

export default function ItemsTable<Row extends ItemRow>({
	items,
	showOwner = false,
	actions
}: {
	items: Row[];
	showOwner?: boolean;
	actions?: (item: Row, displayTitle: string | null) => ReactNode;
}) {
	const colSpan = 2 + Number(showOwner) + Number(Boolean(actions));
	return (
		<div className="overflow-x-auto">
			<table className="ui-table">
				<thead>
					<tr>
						<th>Title</th>
						{showOwner && <th>Owner</th>}
						<th>Created</th>
						{actions && <th className="text-right">Actions</th>}
					</tr>
				</thead>
				<tbody>
					{items.length ? (
						items.map((item) => {
							const record =
								typeof item.data === 'object' && item.data && !Array.isArray(item.data)
									? (item.data as Record<string, unknown>)
									: {};
							const title = record.title ?? record.name ?? record.label;
							const displayTitle = typeof title === 'string' && title.trim() ? title : null;
							const rest = Object.entries(record).filter(
								([key]) => !['title', 'name', 'label'].includes(key)
							);
							return (
								<tr key={item.id}>
									<td>
										<div className="font-medium">{displayTitle ?? '—'}</div>
										{rest.length > 0 && (
											<div className="max-w-xs truncate font-mono text-xs text-ink/50">
												{JSON.stringify(Object.fromEntries(rest))}
											</div>
										)}
									</td>
									{showOwner && <td>{item.owner ?? '—'}</td>}
									<td className="text-sm whitespace-nowrap text-ink/70" suppressHydrationWarning>
										{new Date(item.createdAt).toLocaleString()}
									</td>
									{actions && <td className="text-right">{actions(item, displayTitle)}</td>}
								</tr>
							);
						})
					) : (
						<tr>
							<td colSpan={colSpan} className="text-center text-ink/60">
								No items yet.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
