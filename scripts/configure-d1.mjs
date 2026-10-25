import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

export function databaseId(id) {
	assert.match(
		id ?? '',
		/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i,
		"Set D1_DATABASE_ID to the environment's actual database UUID."
	);
	assert.ok(!/^00000000-/.test(id), 'D1_DATABASE_ID must not be a local placeholder.');
	return id;
}

if (process.argv[2] === '--test') {
	for (const value of [undefined, '', 'invalid', '00000000-0000-0000-0000-000000000000']) {
		assert.throws(() => databaseId(value));
	}
	assert.equal(
		databaseId('12345678-1234-1234-1234-123456789abc'),
		'12345678-1234-1234-1234-123456789abc'
	);
} else {
	const id = databaseId(process.env.D1_DATABASE_ID);
	const path = 'packages/api/wrangler.jsonc';
	writeFileSync(
		path,
		readFileSync(path, 'utf8').replace(/00000000-0000-0000-0000-00000000000[012]/g, id)
	);
}
