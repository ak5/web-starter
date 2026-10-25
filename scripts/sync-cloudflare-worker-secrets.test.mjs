import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function sync(overrides, existing, environment = 'staging') {
	const directory = mkdtempSync(join(tmpdir(), 'worker-secrets-'));
	const log = join(directory, 'calls.jsonl');
	writeFileSync(
		join(directory, 'pnpm'),
		`#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.SECRET_TEST_LOG, JSON.stringify(args) + '\\n');
if (args.includes('list')) console.log(process.env.SECRET_TEST_EXISTING);
else {
 let input = '';
 process.stdin.on('data', chunk => input += chunk);
 process.stdin.on('end', () => {
  if (input !== 'jwt-test' && input !== 'key-test') process.exitCode = 1;
 });
}
`,
		{ mode: 0o755 }
	);
	try {
		const result = spawnSync(
			'bash',
			['scripts/sync-cloudflare-worker-secrets.sh', '--env', environment],
			{
				encoding: 'utf8',
				timeout: 30_000,
				env: {
					...process.env,
					PATH: `${directory}:${process.env.PATH}`,
					JWT_SECRET: '',
					TOKEN_ENCRYPTION_KEY: '',
					DISCORD_CLIENT_SECRET: '',
					...overrides,
					SECRET_TEST_LOG: log,
					SECRET_TEST_EXISTING: JSON.stringify(
						existing.map((name) => ({ name, type: 'secret_text' }))
					)
				}
			}
		);
		return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) };
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

test('applies supplied overrides to the correct Workers without logging values', () => {
	const result = sync({ JWT_SECRET: 'jwt-test', TOKEN_ENCRYPTION_KEY: 'key-test' }, []);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(
		result.calls.map((args) => [args[1], args[6]]),
		[
			['@ak5/api', 'JWT_SECRET'],
			['@ak5/api', 'TOKEN_ENCRYPTION_KEY'],
			['@ak5/web', 'JWT_SECRET'],
			['@ak5/admin', 'JWT_SECRET']
		]
	);
	assert.ok(result.calls.every((args) => args.includes('put') && args.at(-1) === 'staging'));
	assert.ok(!result.stdout.includes('jwt-test') && !result.stdout.includes('key-test'));
});

test('keeps configured runtime keys when GitHub overrides are absent', () => {
	const result = sync({}, ['JWT_SECRET', 'TOKEN_ENCRYPTION_KEY']);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.calls.length, 4);
	assert.ok(result.calls.every((args) => args.includes('list')));
});

test('refuses deployment when a required key exists in neither location', () => {
	const result = sync({}, []);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Missing required secret: JWT_SECRET/);
	assert.equal(result.calls.length, 1);
});

test('accepts the development target without redirecting secrets to staging', () => {
	const result = sync({}, ['JWT_SECRET', 'TOKEN_ENCRYPTION_KEY'], 'development');
	assert.equal(result.status, 0, result.stderr);
	assert.ok(result.calls.every((args) => args.at(-1) === 'development'));
});
