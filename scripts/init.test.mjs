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
	mkdirSync(join(directory, 'scripts'));
	writeFileSync(
		join(directory, 'scripts/mobile.test.mjs'),
		'upstream fixture @ak5/api AK5_API_PORT'
	);
	writeFileSync(join(directory, '.git/config'), 'https://github.com/ak5/web-starter.git');
	writeFileSync(join(directory, '.env'), 'local-only-ak5');
	writeFileSync(join(directory, 'mise.local.toml'), 'local-only-ak5');
	writeFileSync(
		join(directory, 'pnpm-lock.yaml'),
		"'@ak5/api': workspace:*\nintegrity: sha512-testak5checksum==\n"
	);
	writeFileSync(
		join(directory, 'package.json'),
		JSON.stringify({ scripts: { rebrand: 'node scripts/init.mjs' } })
	);
	writeFileSync(
		join(directory, 'README.md'),
		'@ak5/api ak5 AK5_API_PORT\nhttps://github.com/ak5/web-starter.git\ngithub:ak5/web-starter#path:/packages/create\nMade with <3 by [ak5](https://alexander.verver.is).'
	);
	const result = spawnSync(
		process.execPath,
		[resolve('scripts/init.mjs'), '--scope', '@example', '--slug', 'example', '--no-install'],
		{ cwd: directory, encoding: 'utf8' }
	);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		readFileSync(join(directory, 'scripts/mobile.test.mjs'), 'utf8'),
		'upstream fixture @ak5/api AK5_API_PORT'
	);
	const readme = readFileSync(join(directory, 'README.md'), 'utf8');
	assert.ok(readme.startsWith('@example/api example EXAMPLE_API_PORT'));
	assert.ok(readme.includes('https://github.com/ak5/web-starter.git'));
	assert.ok(readme.includes('by [ak5](https://alexander.verver.is)'));
	assert.ok(readme.includes('github:ak5/web-starter#path:/packages/create'));
	assert.equal(
		readFileSync(join(directory, '.git/config'), 'utf8'),
		'https://github.com/ak5/web-starter.git'
	);
	assert.equal(readFileSync(join(directory, '.env'), 'utf8'), 'local-only-ak5');
	assert.equal(readFileSync(join(directory, 'mise.local.toml'), 'utf8'), 'local-only-ak5');
	assert.equal(
		readFileSync(join(directory, 'pnpm-lock.yaml'), 'utf8'),
		"'@example/api': workspace:*\nintegrity: sha512-testak5checksum==\n"
	);
});

test('rebrand reports installation failure and gives a recovery command', (t) => {
	const directory = mkdtempSync(join(tmpdir(), 'starter-rebrand-failure-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	mkdirSync(join(directory, 'bin'));
	writeFileSync(
		join(directory, 'package.json'),
		JSON.stringify({ scripts: { rebrand: 'node scripts/init.mjs' } })
	);
	const commandLog = join(directory, 'commands');
	writeFileSync(
		join(directory, 'bin/pnpm'),
		'#!/bin/sh\nprintf "%s\\n" "$1" >> "$SETUP_TEST_LOG"\nexit 47\n',
		{ mode: 0o755 }
	);
	const result = spawnSync(process.execPath, [resolve('scripts/init.mjs')], {
		cwd: directory,
		encoding: 'utf8',
		env: {
			...process.env,
			PATH: join(directory, 'bin') + ':' + process.env.PATH,
			SETUP_TEST_LOG: commandLog
		}
	});
	assert.equal(result.status, 47);
	assert.equal(readFileSync(commandLog, 'utf8'), 'install\n');
	assert.match(result.stderr, /pnpm install and pnpm format/);
	assert.doesNotMatch(result.stdout, /Done\. This repo/);
	assert.equal(
		JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).scripts.rebrand,
		undefined
	);
});

test('rebrand can remove Discord OAuth from the React Router starter', (t) => {
	const directory = mkdtempSync(join(tmpdir(), 'starter-rebrand-oauth-'));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const files = [
		'packages/web/src/lib/OAuthLogin.tsx',
		'packages/web/src/routes/login.tsx',
		'packages/web/src/routes/register.tsx',
		'packages/api/src/app.ts',
		'packages/api/src/lib/auth-prelogin.ts'
	];
	for (const file of files) {
		mkdirSync(join(directory, file, '..'), { recursive: true });
		writeFileSync(join(directory, file), readFileSync(file, 'utf8'));
	}
	const result = spawnSync(
		process.execPath,
		[resolve('scripts/init.mjs'), '--no-oauth', '--no-install'],
		{ cwd: directory, encoding: 'utf8' }
	);
	assert.equal(result.status, 0, result.stderr);
	for (const file of files.slice(1, 3)) {
		const route = readFileSync(join(directory, file), 'utf8');
		assert.doesNotMatch(route, /OAuthLogin|apiUrl/);
		assert.match(route, /export const action/);
	}
	assert.doesNotMatch(readFileSync(join(directory, files[3]), 'utf8'), /oauthRoutes/);
	assert.match(readFileSync(join(directory, files[4]), 'utf8'), /discordEnabled: false/);
});
