import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const webRequire = createRequire(new URL('../packages/web/package.json', import.meta.url));
const pluginRequire = createRequire(webRequire.resolve('@sveltejs/vite-plugin-svelte'));

for (const entry of ['deepmerge', 'deepmerge/dist/umd.js']) {
	const merge = pluginRequire(entry);
	test(`${entry}: GHSA-gcqx-w48m-w2h4 cannot change a merged object's prototype`, () => {
		const poison = () => JSON.parse('{"__proto__":{"isAdmin":true}}');
		for (const result of [
			merge(Object.create(null), poison()),
			merge(poison(), {}),
			merge(poison(), poison()),
			merge({ session: null }, { session: poison() }).session,
			merge({ session: 0 }, { session: poison() }).session,
			merge([], [poison()])[0],
			merge.all([poison(), {}])
		]) {
			assert.equal(Object.getPrototypeOf(result), Object.prototype);
			assert.equal(result.isAdmin, undefined);
			assert.equal(Object.hasOwn(result, '__proto__'), false);
		}
		assert.equal({}.isAdmin, undefined);
	});
	test(`${entry}: configuration objects, symbols and arrays still merge`, () => {
		const key = Symbol('config');
		assert.deepEqual(
			merge(
				{ nested: { one: 1 }, list: [1], [key]: { one: 1 } },
				{
					nested: { two: 2 },
					list: [2],
					[key]: { two: 2 }
				}
			),
			{ nested: { one: 1, two: 2 }, list: [1, 2], [key]: { one: 1, two: 2 } }
		);
	});
}
