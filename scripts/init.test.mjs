import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('rebrand keeps upstream, author credit and local files intact', (t) => {
	const directory = mkdtempSync(join(tmpdir(), 'starter-rebrand-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	mkdirSync(join(directory, '.git'));
	writeFileSync(join(directory, '.git/config'), 'https://github.com/ak5/web-starter.git');
	writeFileSync(join(directory, '.env'), 'local-only-ak5');
	writeFileSync(
		join(directory, 'package.json'),
		JSON.stringify({ scripts: { rebrand: 'node scripts/init.mjs' } })
	);
	writeFileSync(
		join(directory, 'README.md'),
		'@ak5/api ak5 AK5_API_PORT\nhttps://github.com/ak5/web-starter.git\nMade with <3 by [ak5](https://alexander.verver.is).'
	);
	const result = spawnSync(
		process.execPath,
		[resolve('scripts/init.mjs'), '--scope', '@example', '--slug', 'example', '--no-install'],
		{ cwd: directory, encoding: 'utf8' }
	);
	assert.equal(result.status, 0, result.stderr);
	const readme = readFileSync(join(directory, 'README.md'), 'utf8');
	assert.ok(readme.startsWith('@example/api example EXAMPLE_API_PORT'));
	assert.ok(readme.includes('https://github.com/ak5/web-starter.git'));
	assert.ok(readme.includes('by [ak5](https://alexander.verver.is)'));
	assert.equal(
		readFileSync(join(directory, '.git/config'), 'utf8'),
		'https://github.com/ak5/web-starter.git'
	);
	assert.equal(readFileSync(join(directory, '.env'), 'utf8'), 'local-only-ak5');
});
