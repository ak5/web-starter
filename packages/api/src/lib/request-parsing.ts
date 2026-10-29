import { z } from 'zod';

export async function responseJson<T>(response: Response): Promise<T> {
	return (await response.json()) as T;
}

export function optionalEnum<T extends readonly string[]>(
	values: T,
	value?: string
): T[number] | undefined {
	return value && values.includes(value) ? value : undefined;
}

export function queryOffsetPage(value?: string) {
	const page = Number(value ?? 0);
	return Number.isInteger(page) && page >= 0 ? page : 0;
}

export function queryLimit(value?: string, fallback = 24, max = 100) {
	const limit = Number(value ?? fallback);
	return Number.isInteger(limit) ? Math.min(Math.max(limit, 1), max) : fallback;
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
