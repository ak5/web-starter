import test from 'node:test';
import assert from 'node:assert/strict';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	existsSync,
	symlinkSync,
	readdirSync,
	rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setMobileEnabled, main, gitEnvironment } from './mobile.mjs';

function fixture(t) {
	const root = mkdtempSync(join(tmpdir(), 'starter-mobile-'));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	for (const dir of ['packages/mobile', '.github', 'docs/development'])
		mkdirSync(join(root, dir), { recursive: true });
	writeFileSync(join(root, 'packages/mobile/App.svelte'), 'starter source @ak5/api AK5_API_PORT');
	writeFileSync(join(root, 'packages/mobile/package.json'), '{"name":"@ak5/mobile"}');
	writeFileSync(join(root, 'mise.toml'), '[tools]\nnode = "26"\nruby = "4"\njava = "25"\n');
	writeFileSync(
		join(root, 'pnpm-workspace.yaml'),
		"packages:\n  - packages/*\npatchedDependencies:\n  '@livestore/adapter-expo@0.5.0': patches/native.patch\n  'web-library@1.0.0': patches/web.patch\npeerDependencyRules:\n  allowAny: []\n"
	);
	writeFileSync(
		join(root, '.github/dependabot.yml'),
		'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n  - package-ecosystem: bundler\n    directory: /packages/mobile\n  - package-ecosystem: gradle\n    directory: /packages/mobile/android\n'
	);
	writeFileSync(join(root, 'README.md'), '[Mobile](packages/mobile/README.md)\n');
	writeFileSync(
		join(root, 'docs/development/setup.md'),
		'[Mobile](../../packages/mobile/README.md)\n'
	);
	for (const args of [
		['init', '--quiet'],
		['add', '.'],
		[
			'-c',
			'user.name=Tests',
			'-c',
			'user.email=test@example.invalid',
			'commit',
			'--quiet',
			'-m',
			'Template'
		]
	])
		assert.equal(spawnSync('git', args, { cwd: root, env: gitEnvironment() }).status, 0);
	const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
		cwd: root,
		env: gitEnvironment(),
		encoding: 'utf8'
	}).stdout.trim();
	writeFileSync(
		join(root, '.starter-template.json'),
		JSON.stringify({ revision, scope: '@example', slug: 'example' })
	);
	const repository = pathToFileURL(root).href;
	writeFileSync(join(root, 'packages/mobile/App.svelte'), 'unsaved mobile work');
	writeFileSync(join(root, 'packages/mobile/.env'), 'local-only');
	return { root, repository };
}

test('disable excludes source and native configuration, backing up edits and secrets locally', (t) => {
	const { root } = fixture(t);
	assert.equal(setMobileEnabled(root, false), true);
	assert.ok(!existsSync(join(root, 'packages/mobile')));
	assert.ok(!existsSync(join(root, 'optional/mobile')));
	const backup = join(root, 'tmp', readdirSync(join(root, 'tmp'))[0], 'mobile');
	assert.equal(readFileSync(join(backup, 'App.svelte'), 'utf8'), 'unsaved mobile work');
	assert.equal(readFileSync(join(backup, '.env'), 'utf8'), 'local-only');
	const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
	assert.ok(!workspace.includes('adapter-expo'));
	assert.ok(workspace.includes('web-library'));
	assert.ok(!readFileSync(join(root, 'mise.toml'), 'utf8').includes('ruby'));
	assert.ok(!readFileSync(join(root, '.github/dependabot.yml'), 'utf8').includes('bundler'));
	assert.match(
		readFileSync(join(root, 'README.md'), 'utf8'),
		/https:\/\/github.com\/ak5\/web-starter\/blob\/[a-f0-9]{40}\/packages\/mobile/
	);
	assert.equal(main(['run', 'check'], root), 0);
	assert.throws(() => main(['run', 'dev'], root), /enable first/);
	assert.equal(setMobileEnabled(root, false), false);
});

test('restore downloads the exact pin, rebrands source, and preserves intervening web configuration', (t) => {
	const { root, repository } = fixture(t);
	setMobileEnabled(root, false);
	const file = join(root, 'pnpm-workspace.yaml');
	writeFileSync(file, readFileSync(file, 'utf8') + 'someWebSetting: true\n');
	assert.equal(setMobileEnabled(root, true, { repository }), true);
	assert.equal(
		readFileSync(join(root, 'packages/mobile/App.svelte'), 'utf8'),
		'starter source @example/api EXAMPLE_API_PORT'
	);
	assert.ok(!existsSync(join(root, 'packages/mobile/.env')));
	assert.ok(!existsSync(join(root, '.starter-mobile.json')));
	const workspace = readFileSync(file, 'utf8');
	for (const value of ['adapter-expo', 'web-library', 'someWebSetting: true'])
		assert.ok(workspace.includes(value));
	assert.match(readFileSync(join(root, '.github/dependabot.yml'), 'utf8'), /bundler[\s\S]*gradle/);
	assert.ok(readFileSync(join(root, 'mise.toml'), 'utf8').includes('ruby'));
	assert.ok(
		readFileSync(join(root, 'docs/development/setup.md'), 'utf8').includes(
			'../../packages/mobile/README.md'
		)
	);
	assert.equal(setMobileEnabled(root, true), false);
});

test('empty native patch mapping remains valid', (t) => {
	const { root, repository } = fixture(t);
	const file = join(root, 'pnpm-workspace.yaml');
	writeFileSync(
		file,
		readFileSync(file, 'utf8').replace("  'web-library@1.0.0': patches/web.patch\n", '')
	);
	setMobileEnabled(root, false);
	assert.ok(readFileSync(file, 'utf8').includes('patchedDependencies: {}'));
	setMobileEnabled(root, true, { repository });
	assert.ok(readFileSync(file, 'utf8').includes('adapter-expo'));
});

test('conflicting configuration and failed downloads leave the disabled profile intact', (t) => {
	const { root, repository } = fixture(t);
	setMobileEnabled(root, false);
	const file = join(root, 'pnpm-workspace.yaml'),
		original = readFileSync(file, 'utf8');
	writeFileSync(
		file,
		original.replace(
			'patchedDependencies:',
			"patchedDependencies:\n  '@livestore/adapter-expo@0.5.0': different.patch"
		)
	);
	assert.throws(() => setMobileEnabled(root, true, { repository }), /reconcile it first/);
	writeFileSync(file, original);
	assert.throws(
		() => setMobileEnabled(root, true, { repository: join(root, 'missing-repo') }),
		/Could not download/
	);
	assert.ok(!existsSync(join(root, 'packages/mobile')));
	assert.ok(existsSync(join(root, '.starter-mobile.json')));
	assert.equal(readFileSync(file, 'utf8'), original);
});

test('does not move symlinked source outside the project', (t) => {
	const { root } = fixture(t);
	rmSync(join(root, 'packages/mobile'), { recursive: true });
	mkdirSync(join(root, 'external'));
	symlinkSync(join(root, 'external'), join(root, 'packages/mobile'), 'dir');
	assert.throws(() => setMobileEnabled(root, false), /not a symlink/);
	assert.ok(!existsSync(join(root, '.starter-mobile.json')));
});

test('restoring from a Git hook does not change its parent repository', (t) => {
	const { root, repository } = fixture(t);
	const before = readFileSync(join(root, '.git/HEAD'), 'utf8');
	const previous = {};
	for (const [key, value] of Object.entries({
		GIT_DIR: join(root, '.git'),
		GIT_WORK_TREE: root,
		GIT_INDEX_FILE: join(root, '.git/index')
	})) {
		previous[key] = process.env[key];
		process.env[key] = value;
	}
	try {
		setMobileEnabled(root, false);
		setMobileEnabled(root, true, { repository });
		assert.equal(readFileSync(join(root, '.git/HEAD'), 'utf8'), before);
		assert.ok(!readFileSync(join(root, '.git/config'), 'utf8').includes('bare = true'));
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
});
