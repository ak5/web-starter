import type { ZodError } from 'zod/v4';
import { z } from 'zod/v4/mini';

export function formatDate(date: string | Date): string {
	const d = new Date(date);
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}).format(d);
}

export function formatDateShort(date: string | Date): string {
	const d = new Date(date);
	return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear().toString().slice(-2)}`;
}

export function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatNumber(num?: number): string {
	if (num === undefined) return '0';
	return new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 2
	}).format(num);
}

export function mapOptional<T, R>(val: T | undefined | null, fn: (v: T) => R): R | undefined {
	return val != null ? fn(val) : undefined;
}

export function prettifyError(error: ZodError): string {
	return z
		.prettifyError(error)
		.split('\n')
		.reduce((acc, line) => {
			if (line.includes('✖')) return acc + line + '\n';
			return acc;
		}, '');
}

/**
 * Turn an arbitrary object into a flat array of [objectpath, value].
 *
 * Example: {foo: 1, bar: {baz: 2}, qux: [3, 4]}
 * Output: [['foo', 1], ['bar.baz', 2], ['qux[0]', 3], ['qux[1]', 4]]
 */
export function flatEntries(obj: Record<string, unknown>, prefix = ''): [string, unknown][] {
	const entries: [string, unknown][] = [];
	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (Array.isArray(value)) {
			value.forEach((item, idx) => {
				if (typeof item === 'object' && item !== null) {
					entries.push(...flatEntries(item as Record<string, unknown>, `${path}[${idx}]`));
				} else {
					entries.push([`${path}[${idx}]`, item]);
				}
			});
		} else if (typeof value === 'object' && value !== null) {
			entries.push(...flatEntries(value as Record<string, unknown>, path));
		} else {
			entries.push([path, value]);
		}
	}
	return entries;
}

export function formatCompactNumber(n: number | null | undefined): string {
	if (n == null) return '-';
	if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toString();
}
