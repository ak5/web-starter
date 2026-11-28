import type { PaginationMeta } from '@ak5/shared';
import { Link, useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function visiblePages(active: number, total: number): (number | 'ellipsis')[] {
	if (total <= 7) return Array.from({ length: total }, (_, page) => page);
	const first = Math.max(1, active - 1);
	const last = Math.min(total - 2, active + 1);
	return [
		0,
		...(first > 1 ? ['ellipsis' as const] : []),
		...Array.from({ length: last - first + 1 }, (_, offset) => first + offset),
		...(last < total - 2 ? ['ellipsis' as const] : []),
		total - 1
	];
}

export default function Pagination({ pagination }: { pagination: PaginationMeta }) {
	const { page, totalPages, total, hasPrev, hasNext } = pagination;
	const location = useLocation();
	function to(page: number) {
		const search = new URLSearchParams(location.search);
		search.set('page', String(page));
		return { pathname: location.pathname, search: search.toString() };
	}
	const directions = [
		{ label: 'First page', Icon: ChevronsLeft, page: 0, enabled: hasPrev },
		{ label: 'Previous page', Icon: ChevronLeft, page: page - 1, enabled: hasPrev },
		{ label: 'Next page', Icon: ChevronRight, page: page + 1, enabled: hasNext },
		{ label: 'Last page', Icon: ChevronsRight, page: totalPages - 1, enabled: hasNext }
	];
	if (totalPages <= 1) return null;
	function navigation({ label, Icon, page, enabled }: (typeof directions)[number]) {
		return enabled ? (
			<Link key={label} to={to(page)} className="ui-button ui-button-small" aria-label={label}>
				<Icon className="h-4 w-4" />
			</Link>
		) : (
			<span
				key={label}
				className="ui-button ui-button-disabled ui-button-small"
				aria-disabled="true"
				aria-label={label}
			>
				<Icon className="h-4 w-4" />
			</span>
		);
	}
	return (
		<nav className="mt-6 flex flex-col items-center gap-4" aria-label="Pagination">
			<div className="flex flex-wrap justify-center gap-1">
				{directions.slice(0, 2).map(navigation)}
				{visiblePages(page, totalPages).map((number, index) =>
					number === 'ellipsis' ? (
						<span
							key={`ellipsis-${index}`}
							className="ui-button ui-button-disabled ui-button-small"
						>
							...
						</span>
					) : (
						<Link
							key={number}
							to={to(number)}
							aria-current={number === page ? 'page' : undefined}
							className={`ui-button ui-button-small ${number === page ? 'ui-button-active' : ''}`}
						>
							{number + 1}
						</Link>
					)
				)}
				{directions.slice(2).map(navigation)}
			</div>
			<p className="text-sm text-ink/60">
				Showing page {page + 1} of {totalPages} ({total} total)
			</p>
		</nav>
	);
}
