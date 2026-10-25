import test from 'node:test';
import assert from 'node:assert/strict';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	cpSync,
	existsSync,
	symlinkSync,
	rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createProject, main, gitEnvironment } from '../bin/create.mjs';
import { setMobileEnabled } from '../../../scripts/mobile.mjs';
const source = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
function template(t) {
	const root = mkdtempSync(join(tmpdir(), 'starter-create-test-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const repo = join(root, 'source');
	for (const dir of ['scripts', '.github', 'packages/mobile', 'packages/create', 'docs'])
		mkdirSync(join(repo, dir), { recursive: true });
	for (const file of ['init.mjs', 'mobile.mjs', 'branding.mjs'])
		cpSync(join(source, 'scripts', file), join(repo, 'scripts', file));
	writeFileSync(join(repo, 'mise.toml'), '[tools]\nnode = \"26\"\nruby = \"4\"\njava = \"25\"\n');
	writeFileSync(join(repo, '.starter-template.json'), '{}');
	writeFileSync(join(repo, 'scripts/init.test.mjs'), 'template-only test');
	writeFileSync(
		join(repo, 'package.json'),
		JSON.stringify({
			name: 'ak5-web',
			scripts: {
				rebrand: 'node scripts/init.mjs',
				'test:unit':
					'node --test scripts/init.test.mjs scripts/mobile.test.mjs && pnpm --filter @ak5/create-web-starter test:unit'
			}
		})
	);
	writeFileSync(
		join(repo, 'packages/mobile/package.json'),
		JSON.stringify({ name: '@ak5/mobile' })
	);
	writeFileSync(join(repo, 'packages/mobile/App.svelte'), 'mobile source @ak5/api');
	writeFileSync(
		join(repo, 'packages/create/package.json'),
		JSON.stringify({ name: '@ak5/create-web-starter' })
	);
	writeFileSync(
		join(repo, 'pnpm-workspace.yaml'),
		"packages:\n  - packages/*\npatchedDependencies:\n  '@livestore/adapter-expo@0.5.0': patches/native.patch\n"
	);
	writeFileSync(
		join(repo, '.github/dependabot.yml'),
		'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n  - package-ecosystem: bundler\n    directory: /packages/mobile\n'
	);
	writeFileSync(
		join(repo, 'README.md'),
		'[Mobile](packages/mobile/README.md)\nhttps://github.com/ak5/web-starter\nMade with <3 by [ak5](https://alexander.verver.is).'
	);
	for (const args of [
		['init', '--quiet', '--initial-branch=main'],
		['add', '.'],
		[
			'-c',
			'user.name=Starter Tests',
			'-c',
			'user.email=starter-tests@example.invalid',
			'commit',
			'--quiet',
			'-m',
			'Fixture'
		]
	])
		assert.equal(spawnSync('git', args, { cwd: repo, env: gitEnvironment() }).status, 0);
	return { root, repository: pathToFileURL(repo).href };
}

test('one command creates an independently branded website-only repo with restorable mobile', (t) => {
	const { root, repository } = template(t);
	const output = join(root, 'website');
	createProject(output, { repository, scope: '@example', slug: 'example' });
	assert.ok(existsSync(join(output, '.git')));
	assert.ok(!existsSync(join(output, 'packages/mobile')));
	assert.ok(!existsSync(join(output, 'optional/mobile')));
	assert.ok(existsSync(join(output, '.starter-mobile.json')));

	assert.ok(!existsSync(join(output, 'packages/create')));
	assert.ok(!existsSync(join(output, 'scripts/init.test.mjs')));
	const manifest = JSON.parse(readFileSync(join(output, 'package.json'), 'utf8'));
	assert.ok(!manifest.scripts.rebrand);
	assert.ok(!manifest.scripts['test:unit'].includes('init.test'));
	assert.ok(!manifest.scripts['test:unit'].includes('create-web-starter'));
	setMobileEnabled(output, true, { repository });
	assert.match(readFileSync(join(output, 'packages/mobile/App.svelte'), 'utf8'), /@example\/api/);
	assert.ok(existsSync(join(output, 'packages/mobile/App.svelte')));
	const readme = readFileSync(join(output, 'README.md'), 'utf8');
	assert.ok(readme.includes('https://github.com/ak5/web-starter'));
	assert.ok(readme.includes('by [ak5]'));
});

test('mobile option keeps the mobile workspace active', (t) => {
	const { root, repository } = template(t);
	const output = join(root, 'fullapp');
	createProject(output, { repository, mobile: true });
	assert.ok(existsSync(join(output, 'packages/mobile/App.svelte')));
	assert.ok(!existsSync(join(output, 'optional/mobile')));
});

test('refuses existing destinations and invalid arguments without overwriting files', (t) => {
	const { root, repository } = template(t);
	const output = join(root, 'existing');
	mkdirSync(output);
	writeFileSync(join(output, 'keep.txt'), 'keep');
	assert.throws(() => createProject(output, { repository }), /never overwritten/);
	assert.equal(readFileSync(join(output, 'keep.txt'), 'utf8'), 'keep');
	assert.throws(() => main(['--scope']), /Provide a value/);
	assert.throws(() => main(['app', '--mobile', '--web-only']), /Choose/);
	assert.throws(
		() => createProject(join(root, 'newapp'), { repository, scope: '@bad;value' }),
		/valid --scope/
	);
	assert.ok(!existsSync(join(root, 'newapp')));
});

test('does not overwrite a dangling destination symlink', (t) => {
	const { root, repository } = template(t);
	const destination = join(root, 'dangling');
	symlinkSync(join(root, 'not-created'), destination, 'dir');
	assert.throws(() => createProject(destination, { repository }), /never overwritten/);
	assert.ok(!existsSync(join(root, 'not-created')));
});
