import assert from 'node:assert/strict';
import {
	existsSync,
	lstatSync,
	readFileSync,
	writeFileSync,
	readdirSync,
	renameSync,
	mkdirSync,
	rmSync,
	mkdtempSync,
	cpSync
} from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { makeReplacer, walkReplace } from './branding.mjs';

const ACTIVE = 'packages/mobile';
const UPSTREAM = 'https://github.com/ak5/web-starter.git';
const STATE = '.starter-mobile.json';
const nativePatch =
	/^  ['"]?(?:@livestore\/adapter-expo|@react-native\/gradle-plugin|expo-modules-autolinking|expo-modules-core)@/;

function patchSection(text) {
	const lines = text.split('\n');
	const start = lines.findIndex((line) => /^patchedDependencies:(?:\s*\{\})?\s*$/.test(line));
	assert.ok(start >= 0, 'Expected a patchedDependencies mapping in pnpm-workspace.yaml');
	let end = start + 1;
	while (end < lines.length && (!lines[end] || /^\s/.test(lines[end]))) end++;
	return { lines, start, end };
}

function docFiles(root, dir = 'docs') {
	const files = [];
	if (!existsSync(join(root, dir))) return files;
	for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) files.push(...docFiles(root, path));
		else if (entry.name.endsWith('.md')) files.push(path);
	}
	return files;
}

export function setMobileEnabled(root, enabled, { repository = UPSTREAM } = {}) {
	const active = join(root, ACTIVE),
		statePath = join(root, STATE);
	const activeExists = !!lstatSync(active, { throwIfNoEntry: false });
	if (activeExists === enabled) {
		assert.ok(
			enabled ? !existsSync(statePath) : existsSync(statePath),
			'Mobile profile conflicts with its metadata; review it first.'
		);
		return false;
	}
	if (!enabled) {
		assert.ok(!existsSync(statePath), 'Mobile metadata already exists; refusing to overwrite it.');
		assert.ok(
			lstatSync(active).isDirectory() && !lstatSync(active).isSymbolicLink(),
			'Mobile source must be a real project directory, not a symlink.'
		);
	}
	const originals = new Map(),
		updates = new Map();
	const read = (name) => {
		const text = readFileSync(join(root, name), 'utf8');
		originals.set(name, text);
		return text;
	};
	const workspace = read('pnpm-workspace.yaml');
	const { lines, start, end } = patchSection(workspace);
	const dependabot = read('.github/dependabot.yml');
	const nativeUpdates = (block) => /directory:\s*['"]?\/packages\/mobile(?:[/'"\s]|$)/.test(block);
	const mise = read('mise.toml');
	let state;
	if (!enabled) {
		const template = JSON.parse(readFileSync(join(root, '.starter-template.json'), 'utf8'));
		assert.match(template.revision, /^[a-f0-9]{40}$/, 'Expected a pinned starter commit.');
		const patches = lines.slice(start + 1, end).filter((line) => nativePatch.test(line));
		const kept = lines.slice(start + 1, end).filter((line) => !nativePatch.test(line));
		if (!kept.some((line) => /^  [^#\s]/.test(line))) lines[start] = 'patchedDependencies: {}';
		lines.splice(start + 1, end - start - 1, ...kept);
		const blocks = dependabot.split(/(?=^  - package-ecosystem:)/m);
		const removed = blocks.filter(nativeUpdates);
		updates.set('.github/dependabot.yml', blocks.filter((block) => !nativeUpdates(block)).join(''));
		const tools = mise.split('\n').filter((line) => /^(?:ruby|java)\s*=/.test(line));
		updates.set(
			'mise.toml',
			mise
				.split('\n')
				.filter((line) => !/^(?:ruby|java)\s*=/.test(line))
				.join('\n')
		);
		state = { ...template, patches, dependabot: removed, tools };
	} else {
		state = JSON.parse(readFileSync(statePath, 'utf8'));
		assert.match(state.revision, /^[a-f0-9]{40}$/, 'Expected a pinned starter commit.');
		assert.ok(
			Array.isArray(state.patches) && Array.isArray(state.dependabot) && Array.isArray(state.tools),
			'Invalid mobile profile metadata.'
		);
		for (const line of state.patches) {
			assert.ok(nativePatch.test(line), 'Invalid native patch entry in profile metadata.');
			const key = line.trim().split(':')[0];
			assert.ok(
				!lines.slice(start + 1, end).some((existing) => existing.trim().split(':')[0] === key),
				`Patch ${key} already exists; reconcile it first.`
			);
		}
		if (state.patches.length) lines[start] = 'patchedDependencies:';
		lines.splice(start + 1, 0, ...state.patches);
		assert.ok(
			!dependabot.split(/(?=^  - package-ecosystem:)/m).some(nativeUpdates),
			'Native Dependabot entries already exist; reconcile them first.'
		);
		updates.set('.github/dependabot.yml', dependabot.trimEnd() + '\n' + state.dependabot.join(''));
		for (const tool of state.tools) {
			assert.match(tool, /^(?:ruby|java)\s*=/, 'Invalid native tool entry.');
			assert.ok(
				!new RegExp('^' + tool.split('=')[0].trim() + '\\s*=', 'm').test(mise),
				'Native tool already exists; reconcile it first.'
			);
		}
		updates.set(
			'mise.toml',
			mise.replace('[tools]\n', '[tools]\n' + state.tools.join('\n') + '\n')
		);
	}
	assert.match(state.scope, /^@[a-z0-9][a-z0-9-]*$/, 'Expected a valid application scope.');
	assert.match(state.slug, /^[a-z][a-z0-9]*$/, 'Expected a valid application slug.');
	updates.set('pnpm-workspace.yaml', lines.join('\n'));
	const remote = `https://github.com/ak5/web-starter/blob/${state.revision}/packages/mobile/`;
	for (const name of ['README.md', 'CLAUDE.md', ...docFiles(root)]) {
		if (!existsSync(join(root, name))) continue;
		const before = read(name);
		const after = enabled
			? before.replaceAll(remote, relative(dirname(name), ACTIVE).replaceAll('\\', '/') + '/')
			: before.replace(/(?<=\]\()(?:\.\.?\/)*packages\/mobile\//g, remote);
		if (after !== before) updates.set(name, after);
	}
	let temporary, backup;
	try {
		if (enabled) {
			temporary = mkdtempSync(join(tmpdir(), 'starter-mobile-restore-'));
			for (const args of [
				['init', '--quiet'],
				['remote', 'add', 'origin', repository],
				['fetch', '--quiet', '--depth=1', 'origin', state.revision],
				['sparse-checkout', 'set', 'packages/mobile'],
				['checkout', '--quiet', '--detach', 'FETCH_HEAD']
			])
				assert.equal(
					run('git', args, temporary),
					0,
					'Could not download the pinned mobile source; the disabled profile is unchanged.'
				);
			assert.ok(
				existsSync(join(temporary, ACTIVE, 'package.json')),
				'Pinned starter has no mobile package.'
			);
			walkReplace(join(temporary, ACTIVE), makeReplacer(state.scope, state.slug));
			try {
				cpSync(join(temporary, ACTIVE), active, { recursive: true });
			} catch (error) {
				rmSync(active, { recursive: true, force: true });
				throw error;
			}
		} else {
			mkdirSync(join(root, 'tmp'), { recursive: true });
			backup = mkdtempSync(join(root, 'tmp/mobile-backup-'));
			renameSync(active, join(backup, 'mobile'));
		}
		try {
			for (const [name, value] of updates) writeFileSync(join(root, name), value);
			if (enabled) rmSync(statePath);
			else writeFileSync(statePath, JSON.stringify(state, null, '\t') + '\n');
		} catch (error) {
			if (enabled) rmSync(active, { recursive: true });
			else {
				renameSync(join(backup, 'mobile'), active);
				rmSync(statePath, { force: true });
			}
			for (const [name, value] of originals) writeFileSync(join(root, name), value);
			throw error;
		}
		if (backup)
			console.log(
				`Local mobile files backed up to ${relative(root, backup)}/mobile (not versioned).`
			);
	} finally {
		if (temporary) rmSync(temporary, { recursive: true, force: true });
	}
	return true;
}

// Git hooks export checkout-specific paths; child repositories must use their own.
export function gitEnvironment() {
	const env = { ...process.env };
	for (const key of [
		'GIT_DIR',
		'GIT_WORK_TREE',
		'GIT_COMMON_DIR',
		'GIT_INDEX_FILE',
		'GIT_PREFIX',
		'GIT_OBJECT_DIRECTORY',
		'GIT_ALTERNATE_OBJECT_DIRECTORIES',
		'GIT_GRAFT_FILE',
		'GIT_SHALLOW_FILE'
	])
		delete env[key];
	return env;
}

function run(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		stdio: 'inherit',
		env: command === 'git' ? gitEnvironment() : process.env
	});
	if (result.error) throw result.error;
	return result.status ?? 1;
}

export function main(argv = process.argv.slice(2), root = process.cwd()) {
	const [action, script, ...args] = argv;
	if (action === 'status') {
		console.log(
			existsSync(join(root, ACTIVE))
				? 'Mobile enabled'
				: 'Mobile disabled; restore source from its pinned starter with pnpm mobile enable'
		);
		return 0;
	}
	if (action === 'enable' || action === 'disable') {
		assert.ok(
			argv.slice(1).every((arg) => arg === '--no-install'),
			'Usage: pnpm mobile enable|disable [--no-install]'
		);
		const changed = setMobileEnabled(root, action === 'enable');
		console.log(
			action === 'enable'
				? 'Mobile enabled'
				: 'Mobile disabled; source excluded from the repository'
		);
		return changed && !argv.includes('--no-install') ? run('pnpm', ['install'], root) : 0;
	}
	if (action === 'run' && script) {
		if (!existsSync(join(root, ACTIVE))) {
			if (['check', 'test:unit', 'bundle:ios', 'bundle:android'].includes(script)) {
				console.log(`Mobile disabled: skipping ${script}`);
				return 0;
			}
			throw new Error('Mobile is disabled. Run pnpm mobile enable first.');
		}
		return run('pnpm', ['run', script, ...args], join(root, ACTIVE));
	}
	throw new Error('Usage: pnpm mobile enable|disable|status|run <script>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		process.exitCode = main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
