// Convention: `page` is 0-indexed everywhere. The API computes
// `offset = page * limit`; the frontend sends `String(page)` and displays
// `page + 1` for humans.
export const PAGE_SIZE = 50;

export function getPaginationParams(url: URL, pageSize: number = PAGE_SIZE) {
	// Coerce missing / negative / non-numeric `page` to 0 so `offset` is never NaN.
	const raw = parseInt(url.searchParams.get('page') ?? '', 10);
	const page = Number.isFinite(raw) && raw > 0 ? raw : 0;
	const offset = page * pageSize;
	return { page, offset, limit: pageSize };
}

export function getPaginationMeta(total: number, page: number, pageSize: number = PAGE_SIZE) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	return {
		total,
		page,
		totalPages,
		hasNext: page + 1 < totalPages,
		hasPrev: page > 0
	};
}

export type PaginationMeta = ReturnType<typeof getPaginationMeta>;
