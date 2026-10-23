import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capitalize, flatEntries, formatCompactNumber } from './util.js';

describe('capitalize', () => {
	it('uppercases the first character', () => {
		assert.equal(capitalize('hello'), 'Hello');
		assert.equal(capitalize(''), '');
	});
});

describe('formatCompactNumber', () => {
	it('formats magnitudes with a suffix', () => {
		assert.equal(formatCompactNumber(999), '999');
		assert.equal(formatCompactNumber(1_500), '1.5K');
		assert.equal(formatCompactNumber(2_000_000), '2.0M');
		assert.equal(formatCompactNumber(3_000_000_000), '3.0B');
	});

	it('renders nullish as a dash', () => {
		assert.equal(formatCompactNumber(null), '-');
		assert.equal(formatCompactNumber(undefined), '-');
	});
});

describe('flatEntries', () => {
	it('flattens nested objects and arrays to path/value pairs', () => {
		assert.deepEqual(flatEntries({ foo: 1, bar: { baz: 2 }, qux: [3, 4] }), [
			['foo', 1],
			['bar.baz', 2],
			['qux[0]', 3],
			['qux[1]', 4]
		]);
	});
});
