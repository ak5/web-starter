import type { ReactNode } from 'react';

type ItemRow = {
	id: string;
	data: unknown;
	createdAt: string;
	owner?: string | null;
};

export default function ItemsTable({
	items,
	showOwner = false,
	actions
}: {
	items: ItemRow[];
	showOwner?: boolean;
	actions?: (item: ItemRow) => ReactNode;
}) {
	const colSpan = 2 + Number(showOwner) + Number(Boolean(actions));
	return (
		<div className="overflow-x-auto">
			<table className="table">
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
							const rest = Object.entries(record).filter(
								([key]) => !['title', 'name', 'label'].includes(key)
							);
							return (
								<tr key={item.id}>
									<td>
										<div className="font-medium">
											{typeof title === 'string' && title.trim() ? title : '—'}
										</div>
										{rest.length > 0 && (
											<div className="max-w-xs truncate font-mono text-xs text-base-content/50">
												{JSON.stringify(Object.fromEntries(rest))}
											</div>
										)}
									</td>
									{showOwner && <td>{item.owner ?? '—'}</td>}
									<td
										className="text-sm whitespace-nowrap text-base-content/70"
										suppressHydrationWarning
									>
										{new Date(item.createdAt).toLocaleString()}
									</td>
									{actions && <td className="text-right">{actions(item)}</td>}
								</tr>
							);
						})
					) : (
						<tr>
							<td colSpan={colSpan} className="text-center text-base-content/60">
								No items yet.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
}
