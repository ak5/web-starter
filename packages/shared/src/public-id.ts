import { customAlphabet } from 'nanoid';

/**
 * Public IDs are short, URL-safe identifiers exposed in APIs, JWTs, and frontend
 * code. Sequential numeric primary keys are NEVER exposed externally.
 *
 * Each entity type has a single-letter or short prefix to make IDs self-describing
 * in logs, URLs, and during debugging. Add a prefix here when you add an entity
 * that needs an externally-visible identifier.
 */
export const PUBLIC_ID_PREFIXES = {
	user: 'u',
	admin: 'a',
	token: 't',
	session: 'se',
	apiKey: 'ak',
	item: 'i'
} as const;

export type PublicIdEntity = keyof typeof PUBLIC_ID_PREFIXES;

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

export function publicId(entity: PublicIdEntity): string {
	return `${PUBLIC_ID_PREFIXES[entity]}-${nanoid()}`;
}

export function isPublicId(value: string, entity?: PublicIdEntity): boolean {
	if (entity) {
		return value.startsWith(`${PUBLIC_ID_PREFIXES[entity]}-`);
	}
	return /^[a-z]{1,3}-[0-9a-z]{6,}$/.test(value);
}
