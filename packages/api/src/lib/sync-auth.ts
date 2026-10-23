import { and, eq, isNull } from 'drizzle-orm';
import { COOKIE_TOKEN, parseCookie } from '@ak5/shared';
import { db } from '../db';
import { users } from '../db/schema';
import { verifyJwt } from './jwt';
import type { Env } from '../types';
import { z } from 'zod';

/** Independent of client IDs and payload claims: each user owns exactly one notes store. */
export async function authorizeSync(
	env: Env,
	headers: { get(name: string): string | null | undefined },
	storeId: string
) {
	let token: string | undefined;
	try {
		token = parseCookie(headers.get('cookie') ?? '', COOKIE_TOKEN);
	} catch {
		return false;
	}
	if (!token) return false;
	const auth = await verifyJwt(env.JWT_SECRET, token).catch(() => null);
	if (
		!auth ||
		!/^u-[a-z0-9]{10}$/.test(auth.sub) ||
		auth.type !== 'user' ||
		storeId !== `notes-v1-${auth.sub}`
	)
		return false;
	const user = await db(env.DB).query.users.findFirst({
		where: and(eq(users.publicId, auth.sub), isNull(users.deletedAt), isNull(users.bannedAt)),
		columns: { id: true }
	});
	return Boolean(user);
}
const id = z.string().regex(/^n-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
const event = z.discriminatedUnion('name', [
	z.object({
		name: z.literal('v1.NoteSet'),
		args: z
			.object({
				id,
				text: z
					.string()
					.min(1)
					.max(2000)
					.refine((value) => value.trim().length > 0),
				updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
			})
			.strict()
	}),
	z.object({ name: z.literal('v1.NoteDeleted'), args: z.object({ id }).strict() })
]);
export function validateNoteEvents(batch: readonly unknown[]) {
	for (const value of batch) {
		if (!event.safeParse(value).success) throw new Error('Invalid notes event');
	}
}
