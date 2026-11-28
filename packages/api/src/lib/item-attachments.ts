import { and, eq, exists, gt, sql } from 'drizzle-orm';
import type { JwtPayload } from '@ak5/shared';
import type { Database } from '../db';
import { attachmentCleanup, itemAttachments, items } from '../db/schema';
import { getActiveUserByAuth } from './auth-subject';

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_REQUEST_BYTES = MAX_ATTACHMENT_BYTES + 16 * 1024;

const notFound = { ok: false, status: 404, error: 'not_found' } as const;
const unavailable = { ok: false, status: 503, error: 'attachment_storage_unavailable' } as const;

async function ownedItem(db: Database, auth: JwtPayload, id: string) {
	if (auth.impersonatedBy) return null;
	const active = await getActiveUserByAuth(db, auth);
	if ('error' in active) return null;
	return db.query.items.findFirst({
		columns: { id: true },
		where: and(eq(items.publicId, id), eq(items.userId, active.user.id))
	});
}

async function validateFile(file: File) {
	const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	const header = String.fromCharCode(...prefix);
	const name = file.name
		.split(/[/\\]/)
		.at(-1)
		?.replace(/\p{Cc}/gu, '')
		.slice(-180);
	if (!name) return null;
	if (file.type === 'application/pdf' && /\.pdf$/i.test(name) && header.startsWith('%PDF-'))
		return { name, contentType: 'application/pdf' as const };
	if (
		file.type === 'image/webp' &&
		/\.webp$/i.test(name) &&
		header.startsWith('RIFF') &&
		header.slice(8) === 'WEBP'
	)
		return { name, contentType: 'image/webp' as const };
	return null;
}

export async function uploadItemAttachment(
	db: Database,
	bucket: R2Bucket | undefined,
	auth: JwtPayload,
	id: string,
	file: File
) {
	const item = await ownedItem(db, auth, id);
	if (!item) return notFound;
	if (!bucket) return unavailable;
	if (file.size > MAX_ATTACHMENT_BYTES)
		return { ok: false, status: 413, error: 'attachment_too_large' } as const;
	const metadata = await validateFile(file);
	if (!metadata) return { ok: false, status: 415, error: 'invalid_attachment_type' } as const;
	const key = `items/${crypto.randomUUID()}`;
	const cleanupAt = new Date(Date.now() + 60 * 60 * 1000);
	await db.insert(attachmentCleanup).values({ objectKey: key, after: cleanupAt });

	try {
		await bucket.put(key, file, { httpMetadata: { contentType: metadata.contentType } });
	} catch {
		return unavailable;
	}
	const reservation = exists(
		db
			.select({ key: attachmentCleanup.objectKey })
			.from(attachmentCleanup)
			.where(and(eq(attachmentCleanup.objectKey, key), gt(attachmentCleanup.after, new Date())))
	);
	const attached = exists(
		db
			.select({ key: itemAttachments.objectKey })
			.from(itemAttachments)
			.where(eq(itemAttachments.objectKey, key))
	);
	const [[created]] = await db.batch([
		db
			.insert(itemAttachments)
			.select(
				db
					.select({
						itemId: items.id,
						objectKey: sql<string>`${key}`.as('object_key'),
						name: sql<string>`${metadata.name}`.as('name'),
						contentType: sql<typeof metadata.contentType>`${metadata.contentType}`.as(
							'content_type'
						),
						size: sql<number>`${file.size}`.as('size')
					})
					.from(items)
					.where(and(eq(items.id, item.id), reservation))
			)
			.onConflictDoNothing()
			.returning({
				name: itemAttachments.name,
				contentType: itemAttachments.contentType,
				size: itemAttachments.size
			}),
		db.delete(attachmentCleanup).where(and(eq(attachmentCleanup.objectKey, key), attached))
	]);
	if (created) return { ok: true as const, result: created };
	await db
		.insert(attachmentCleanup)
		.values({ objectKey: key, after: new Date() })
		.onConflictDoNothing();
	return { ok: false, status: 409, error: 'attachment_conflict' } as const;
}

export async function downloadItemAttachment(
	db: Database,
	bucket: R2Bucket | undefined,
	auth: JwtPayload,
	id: string
) {
	const item = await ownedItem(db, auth, id);
	if (!item) return new Response(null, { status: 404 });
	if (!bucket) return new Response(null, { status: 503 });
	const file = await db.query.itemAttachments.findFirst({
		where: eq(itemAttachments.itemId, item.id)
	});
	if (!file) return new Response(null, { status: 404 });
	let object: R2ObjectBody | null;
	try {
		object = await bucket.get(file.objectKey);
	} catch {
		return new Response(null, { status: 503 });
	}
	if (!object) return new Response(null, { status: 404 });
	const safeName = new TextDecoder().decode(new TextEncoder().encode(file.name));
	const encoded = encodeURIComponent(safeName).replace(
		/['()*]/g,
		(c) => '%' + c.charCodeAt(0).toString(16)
	);
	return new Response(object.body, {
		headers: {
			'Content-Type': file.contentType,
			'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
			'X-Content-Type-Options': 'nosniff'
		}
	});
}

export async function removeItemAttachment(db: Database, auth: JwtPayload, id: string) {
	const item = await ownedItem(db, auth, id);
	if (!item) return notFound;
	const match = eq(itemAttachments.itemId, item.id);
	const [, deleted] = await db.batch([
		db
			.insert(attachmentCleanup)
			.select(
				db
					.select({
						objectKey: itemAttachments.objectKey,
						after: sql<number>`${Date.now()}`.as('after')
					})
					.from(itemAttachments)
					.where(match)
			)
			.onConflictDoNothing(),
		db.delete(itemAttachments).where(match).returning({ id: itemAttachments.itemId })
	]);
	return deleted.length ? { ok: true as const, result: { ok: true } } : notFound;
}
