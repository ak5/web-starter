import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isPublicId, PUBLIC_ID_PREFIXES, publicId, type PublicIdEntity } from './public-id.js';

describe('publicId', () => {
	it('prefixes by entity', () => {
		assert.match(publicId('user'), /^u-[0-9a-z]+$/);
		assert.match(publicId('admin'), /^a-[0-9a-z]+$/);
		assert.match(publicId('item'), /^i-[0-9a-z]+$/);
	});

	it('is unique across calls', () => {
		assert.notEqual(publicId('item'), publicId('item'));
	});

	it('every prefix produces an id recognized by isPublicId', () => {
		for (const entity of Object.keys(PUBLIC_ID_PREFIXES) as PublicIdEntity[]) {
			const id = publicId(entity);
			assert.ok(isPublicId(id), `${id} should be a public id`);
			assert.ok(isPublicId(id, entity), `${id} should match entity ${entity}`);
		}
	});
});

describe('isPublicId', () => {
	it('checks the entity prefix', () => {
		const item = publicId('item');
		assert.ok(isPublicId(item, 'item'));
		assert.ok(!isPublicId(item, 'user'));
	});

	it('rejects non-public-id strings', () => {
		assert.ok(!isPublicId('123'));
		assert.ok(!isPublicId('plainstring'));
		assert.ok(!isPublicId(''));
	});
});
