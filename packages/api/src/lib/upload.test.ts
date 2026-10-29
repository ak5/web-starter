import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadImage } from './upload';

test('avatar uploads reject disguised files and set an explicit image content type', async () => {
	let options: unknown;
	let writes = 0;
	const bucket = {
		put: async (_key: string, _file: File, metadata: unknown) => {
			writes++;
			options = metadata;
		}
	} as unknown as R2Bucket;
	const fake = new File(['<html>not an image</html>'], 'avatar.webp', { type: 'image/webp' });
	assert.ok('error' in (await uploadImage(bucket, 'https://cdn.example.test', fake)));
	assert.equal(writes, 0);
	const header = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
	const result = await uploadImage(
		bucket,
		'https://cdn.example.test',
		new File([header], 'avatar.webp', { type: 'image/webp' })
	);
	assert.ok('url' in result);
	assert.deepEqual(options, { httpMetadata: { contentType: 'image/webp' } });
});
