import { nanoid } from 'nanoid';
import { MAX_FILE_SIZE } from '@ak5/shared';

/**
 * Upload an image to R2. Checks WebP signature, MIME, extension and size, then writes to the
 * bucket with a nanoid-prefixed key. Returns the CDN URL on success.
 */
export async function uploadImage(
	R2: R2Bucket,
	publicR2Url: string,
	file: File,
	options?: { prefix?: string }
): Promise<{ url: string } | { error: string }> {
	if (file.size > MAX_FILE_SIZE) return { error: 'File must be under 5MB' };
	if (file.type !== 'image/webp') return { error: 'File must be a webp image' };
	const ext = file.name.split('.').pop()?.toLowerCase();
	if (ext !== 'webp') return { error: 'File must have a .webp extension' };

	const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (
		header.length !== 12 ||
		String.fromCharCode(...header.slice(0, 4)) !== 'RIFF' ||
		String.fromCharCode(...header.slice(8, 12)) !== 'WEBP'
	)
		return { error: 'File must contain a WebP image' };

	const key = options?.prefix ? `${options.prefix}/${nanoid()}.webp` : `${nanoid()}.webp`;
	try {
		await R2.put(key, file, { httpMetadata: { contentType: 'image/webp' } });
	} catch {
		return { error: 'Failed to upload file' };
	}
	return { url: `${publicR2Url}/${key}` };
}
