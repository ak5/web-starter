import { z } from 'zod';

export async function requestJsonRecord(request: Request): Promise<Record<string, unknown>> {
	return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function responseJson<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}

export function optionalEnum<T extends readonly string[]>(
	values: T,
	value?: string
): T[number] | undefined {
	return value && values.includes(value) ? value : undefined;
}

export function queryPage(value?: string) {
	const page = Number(value ?? 1);
	return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function queryOffsetPage(value?: string) {
	const page = Number(value ?? 0);
	return Number.isInteger(page) && page >= 0 ? page : 0;
}

export function queryLimit(value?: string, fallback = 24, max = 100) {
	const limit = Number(value ?? fallback);
	return Number.isInteger(limit) ? Math.min(Math.max(limit, 1), max) : fallback;
}

export function paginationMeta(total: number, page: number, pageSize: number) {
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	return {
		total,
		page,
		totalPages,
		hasNext: page < totalPages,
		hasPrev: page > 1
	};
}

export function filterOptionRows<T extends { code: string; name: string }>(
	options: T[],
	codes: string[]
) {
	if (codes.length === 0) return options;
	const available = new Set(codes);
	return options.filter((option) => available.has(option.code));
}

export function countryFilter(value?: string) {
	const country = value?.trim().toUpperCase();
	return country?.length === 2 ? country : undefined;
}

export function languageFilter(value?: string) {
	const language = value?.trim();
	return language && language.length <= 8 ? language : undefined;
}

export function dollarsToCents(value?: string) {
	if (value === undefined) return undefined;
	const amount = Number(value);
	return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

export function centsStringToCents(value?: string) {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	if (!/^\d+$/.test(trimmed)) return undefined;
	const amount = Number(trimmed);
	return Number.isSafeInteger(amount) ? amount : undefined;
}

export function optionalTrimmedString(max?: number) {
	const schema = max === undefined ? z.string().trim() : z.string().trim().max(max);
	return schema.transform((value) => value || undefined).optional();
}

export function optionalBlankNullableString(schema: z.ZodString) {
	return z.union([schema, z.literal('').transform(() => null), z.null()]).optional();
}

export function optionalQueryFilter(value: string | undefined, max: number) {
	const trimmed = value?.trim();
	return trimmed && trimmed.length <= max ? trimmed : undefined;
}
