import { eq, and, gt } from 'drizzle-orm';
import type { Database } from '../db';
import { tokens } from '../db/schema';

const PIN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 6-character alphanumeric PIN for email verification. */
export function generatePin(): string {
	const buf = new Uint8Array(6);
	crypto.getRandomValues(buf);
	let pin = '';
	for (const b of buf) pin += PIN_CHARS[b % PIN_CHARS.length];
	return pin;
}

/** Hex-encoded SHA-256, used to store token PINs/secrets at rest. */
export async function sha256Hex(value: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	const bytes = new Uint8Array(hash);
	let hex = '';
	for (const b of bytes) hex += b.toString(16).padStart(2, '0');
	return hex;
}

/** Random URL-safe magic-link token. */
export function generateMagicToken(): string {
	const buf = new Uint8Array(24);
	crypto.getRandomValues(buf);
	return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type TokenSubject = { userId: string } | { adminId: string };

/** Insert a token row. The plaintext token (pin or magic-link) is hashed. */
export async function issueToken(
	db: Database,
	subject: TokenSubject,
	purpose: typeof tokens.$inferInsert.purpose,
	plaintext: string,
	expiresAt: Date,
	payload?: Record<string, unknown>
): Promise<void> {
	await db.insert(tokens).values({
		userId: 'userId' in subject ? subject.userId : null,
		adminId: 'adminId' in subject ? subject.adminId : null,
		purpose,
		tokenHash: await sha256Hex(plaintext),
		expiresAt,
		payload
	});
}

/**
 * Consume a token by its plaintext value + purpose. Returns the row on success
 * (and deletes it). Returns null if no live row matched.
 */
export async function consumeToken(
	db: Database,
	purpose: typeof tokens.$inferInsert.purpose,
	plaintext: string
): Promise<typeof tokens.$inferSelect | null> {
	const hash = await sha256Hex(plaintext);
	const candidate = db
		.select({ id: tokens.id })
		.from(tokens)
		.where(
			and(eq(tokens.purpose, purpose), eq(tokens.tokenHash, hash), gt(tokens.expiresAt, new Date()))
		)
		.limit(1);
	const rows = await db.delete(tokens).where(eq(tokens.id, candidate)).returning();
	return rows[0] ?? null;
}
