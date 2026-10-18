import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getPaginationMeta, getPaginationParams, PAGE_SIZE } from './pagination.js';

const params = (qs: string) => getPaginationParams(new URL(`https://x.test/${qs}`));

describe('getPaginationParams', () => {
	it('reads page and computes offset = page * limit', () => {
		assert.deepEqual(params('?page=2'), { page: 2, offset: 2 * PAGE_SIZE, limit: PAGE_SIZE });
	});

	it('defaults missing page to 0', () => {
		assert.deepEqual(params(''), { page: 0, offset: 0, limit: PAGE_SIZE });
	});

	it('clamps negative and non-numeric page to 0 (never NaN offset)', () => {
		assert.equal(params('?page=-5').page, 0);
		assert.equal(params('?page=abc').offset, 0);
		assert.ok(Number.isFinite(params('?page=abc').offset));
	});
});

describe('getPaginationMeta', () => {
	it('empty set still reports one page', () => {
		assert.deepEqual(getPaginationMeta(0, 0), {
			total: 0,
			page: 0,
			totalPages: 1,
			hasNext: false,
			hasPrev: false
		});
	});

	it('computes hasNext / hasPrev at the boundaries', () => {
		// 120 items / 50 per page = 3 pages (0,1,2).
		const first = getPaginationMeta(120, 0);
		assert.equal(first.totalPages, 3);
		assert.equal(first.hasNext, true);
		assert.equal(first.hasPrev, false);

		const middle = getPaginationMeta(120, 1);
		assert.equal(middle.hasNext, true);
		assert.equal(middle.hasPrev, true);

		const last = getPaginationMeta(120, 2);
		assert.equal(last.hasNext, false);
		assert.equal(last.hasPrev, true);
	});
});
