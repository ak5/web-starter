#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
	existsSync,
	lstatSync,
	mkdtempSync,
	cpSync,
	rmSync,
	readFileSync,
	writeFileSync,
	mkdirSync
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const UPSTREAM = 'https://github.com/ak5/web-starter.git';

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
	assert.equal(
		result.status,
		0,
		`${command} failed; inspect the generated directory before retrying.`
	);
}

export function createProject(
	directory,
	{ scope, slug, mobile = false, oauth = true, install = false, repository = UPSTREAM } = {}
) {
	const destination = resolve(directory);
	assert.ok(
		!lstatSync(destination, { throwIfNoEntry: false }),
		'Choose a destination directory that does not exist; existing files are never overwritten.'
	);
	slug ??=
		basename(destination)
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '') || 'myapp';
	scope ??= '@' + slug;
	assert.match(
		slug,
		/^[a-z][a-z0-9]*$/,
		'Use a lowercase alphanumeric --slug beginning with a letter.'
	);
	assert.match(scope, /^@[a-z0-9][a-z0-9-]*$/, 'Use a valid --scope such as @mycompany.');
	const temporary = mkdtempSync(join(tmpdir(), 'create-web-starter-'));
	try {
		const template = join(temporary, 'template');
		run('git', ['clone', '--quiet', '--depth', '1', repository, template], temporary);
		assert.ok(
			existsSync(join(template, 'scripts/init.mjs')) &&
				existsSync(join(template, 'scripts/mobile.mjs')),
			'The template must include the current starter tools.'
		);
		mkdirSync(resolve(destination, '..'), { recursive: true });
		cpSync(template, destination, {
			recursive: true,
			filter: (path) => path !== join(template, '.git')
		});
		const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
			cwd: template,
			encoding: 'utf8',
			env: gitEnvironment()
		}).stdout.trim();
		assert.match(revision, /^[a-f0-9]{40}$/);
		writeFileSync(
			join(destination, '.starter-template.json'),
			JSON.stringify({ revision }, null, '\t') + '\n'
		);
		const args = [
			join(destination, 'scripts/init.mjs'),
			'--scope',
			scope,
			'--slug',
			slug,
			'--no-install'
		];
		if (!mobile) args.push('--no-mobile');
		if (!oauth) args.push('--no-oauth');
		run(process.execPath, args, destination);
		const creatorPath = join(destination, 'packages/create');
		const creatorName = JSON.parse(readFileSync(join(creatorPath, 'package.json'), 'utf8')).name;
		rmSync(creatorPath, { recursive: true });
		const manifestPath = join(destination, 'package.json');
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		if (manifest.scripts?.['test:unit'])
			manifest.scripts['test:unit'] = manifest.scripts['test:unit']
				.split(' && ')
				.filter((command) => !command.includes(`--filter ${creatorName} `))
				.join(' && ');
		writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
		run('git', ['init', '--quiet', '--initial-branch=main'], destination);
		if (install) run('mise', ['exec', '--', 'pnpm', 'install'], destination);
		console.log(
			`\nCreated ${destination} (${mobile ? 'web + mobile' : 'website only'}).\nNext: cd ${JSON.stringify(destination)}\n  mise install\n  pnpm install\n  pnpm dev:init\n  pnpm db:migrate\n  pnpm dev:auto\n\nMobile can be enabled later with: pnpm mobile enable`
		);
		return destination;
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}

export function main(argv = process.argv.slice(2)) {
	if (argv.includes('--help') || argv.includes('-h')) {
		console.log(
			'create-web-starter <directory> [--scope @company] [--slug myapp] [--mobile|--web-only] [--no-oauth] [--install]\nDefaults: website only, OAuth enabled, dependencies installed separately.'
		);
		return;
	}
	let directory;
	const options = {};
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === '--scope' || argument === '--slug') {
			assert.ok(
				argv[index + 1] && !argv[index + 1].startsWith('--'),
				`Provide a value for ${argument}`
			);
			options[argument.slice(2)] = argv[++index];
		} else if (argument === '--mobile') options.mobile = true;
		else if (argument === '--web-only') options.mobile = false;
		else if (argument === '--no-oauth') options.oauth = false;
		else if (argument === '--install') options.install = true;
		else {
			assert.ok(
				!argument.startsWith('-') && directory === undefined,
				`Unexpected argument: ${argument}`
			);
			directory = argument;
		}
	}
	assert.ok(directory, 'Provide the destination directory; use --help for usage.');
	assert.ok(
		!(argv.includes('--mobile') && argv.includes('--web-only')),
		'Choose --mobile or --web-only.'
	);
	return createProject(directory, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
