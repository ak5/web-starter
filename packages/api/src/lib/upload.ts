import { nanoid } from 'nanoid';
import { MAX_FILE_SIZE } from '@ak5/shared';

/**
 * Upload an image to R2. Validates webp + size up-front, then writes to the
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

	const key = options?.prefix ? `${options.prefix}/${nanoid()}.webp` : `${nanoid()}.webp`;
	try {
		await R2.put(key, file);
	} catch {
		return { error: 'Failed to upload file' };
	}
	return { url: `${publicR2Url}/${key}` };
}

export async function deleteUploadedImage(
	R2: R2Bucket,
	publicR2Url: string,
	imageUrl: string | null | undefined
) {
	const key = getPublicR2ObjectKey(publicR2Url, imageUrl);
	if (!key) return false;
	await R2.delete(key);
	return true;
}

function getPublicR2ObjectKey(publicR2Url: string, imageUrl: string | null | undefined) {
	if (!imageUrl) return null;

	try {
		const publicBase = new URL(publicR2Url);
		const uploaded = new URL(imageUrl);
		if (publicBase.origin !== uploaded.origin) return null;

		const basePath = publicBase.pathname.replace(/\/+$/, '');
		if (
			basePath &&
			uploaded.pathname !== basePath &&
			!uploaded.pathname.startsWith(`${basePath}/`)
		) {
			return null;
		}

		const pathname = basePath ? uploaded.pathname.slice(basePath.length) : uploaded.pathname;
		const key = pathname.replace(/^\/+/, '');
		return key ? decodeURIComponent(key) : null;
	} catch {
		return null;
	}
}
