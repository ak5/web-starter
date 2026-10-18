#!/usr/bin/env node
/**
 * One-shot rebrand for a forked starter. Run ONCE after forking:
 *
 *   pnpm rebrand --scope @myco --slug myapp [--no-oauth] [--no-install]
 *
 * It rewrites the repo in place using three literal token rules, applied in
 * order so they don't overlap:
 *   1. `@ak5`  → the chosen scope   (package names: @ak5/api → @myco/api)
 *   2. `AK5_`  → SLUG-upper + `_`   (env prefix: AK5_API_PORT → MYAPP_API_PORT)
 *   3. `ak5`   → the chosen slug    (cookies, dev domain, worker names, …)
 *
 * Then it optionally strips Discord OAuth login, reinstalls dependencies, and finally removes itself + the
 * `rebrand` script from package.json. Running with no `--scope`/`--slug` is a
 * valid way to only drop overlays (the token rules become identity transforms).
 *
 * Pure Node (no shell, no deps) so it runs the same on macOS/Linux/Windows.
 */
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SELF = 'scripts/init.mjs'; // skip self during replace; deleted at the end

// Directories/files never rewritten (VCS + build + local artifacts).
const IGNORE = new Set([
	'.git',
	'tmp',
	'node_modules',
	'.svelte-kit',
	'.wrangler',
	'dist',
	'build',
	'.turbo',
	'.eslintcache',
	'.caddy',
	'.ak5-config',
	'.env',
	'.env.dev-slot',
	'test-results',
	'playwright-report',
	'worker-configuration.d.ts',
	'.DS_Store',
	'Pods',
	'.gradle',
	'.cxx',
	'.kotlin',
	'.bundle'
]);

// Extensions treated as text (token-replaced). Everything else is left as-is.
const TEXT_EXT = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.mjs',
	'.cjs',
	'.json',
	'.jsonc',
	'.svelte',
	'.css',
	'.html',
	'.md',
	'.sql',
	'.sh',
	'.yml',
	'.yaml',
	'.toml',
	'.txt',
	'.example',
	'.svg',
	'.gitignore',
	'.npmrc',
	'.prettierrc',
	'.prettierignore',
	'.swift',
	'.kt',
	'.gradle',
	'.cxx',
	'.kotlin',
	'.bundle',
	'.pbxproj',
	'.plist',
	'.xml'
]);

function isText(name) {
	const dot = name.lastIndexOf('.');
	const ext = dot === -1 ? '' : name.slice(dot);
	return TEXT_EXT.has(ext) || name === '.gitignore' || name === '.npmrc';
}

function parseArgs(argv) {
	const opts = { scope: '@ak5', slug: 'ak5', oauth: true, install: true };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--scope') opts.scope = argv[++i];
		else if (a === '--slug') opts.slug = argv[++i];
		else if (a === '--no-oauth') opts.oauth = false;
		else if (a === '--no-install') opts.install = false;
		else if (a === '-h' || a === '--help') opts.help = true;
	}
	return opts;
}

function help() {
	console.log(`rebrand — one-shot rebrand for a forked starter

Usage:
  pnpm rebrand --scope @myco --slug myapp [options]

Options:
  --scope <@scope>   package scope (default: @ak5 — unchanged)
  --slug <slug>      brand slug for worker names / cookies / dev domain (default: ak5)
  --no-oauth         remove the Discord OAuth-login overlay
  --no-install       skip the post-rebrand \`pnpm install\`
`);
}

function makeReplacer(scope, slug) {
	const envPrefix = slug.toUpperCase().replace(/[^A-Z0-9]/g, '') + '_';
	return (text) =>
		text.split('@ak5').join(scope).split('AK5_').join(envPrefix).split('ak5').join(slug);
}

function walkReplace(dir, replace, relBase = '') {
	for (const entry of readdirSync(dir)) {
		if (IGNORE.has(entry)) continue;
		const abs = join(dir, entry);
		const rel = relBase ? `${relBase}/${entry}` : entry;
		if (rel === SELF) continue; // never rewrite this script
		const st = statSync(abs);
		if (st.isDirectory()) {
			walkReplace(abs, replace, rel);
		} else if (isText(entry)) {
			const before = readFileSync(abs, 'utf8');
			const after = replace(before);
			if (after !== before) writeFileSync(abs, after);
		}
	}
}

function removeOAuthOverlay() {
	rmSync(join(ROOT, 'packages/api/src/routes/oauth'), { recursive: true, force: true });
	rmSync(join(ROOT, 'packages/api/src/lib/oauth'), { recursive: true, force: true });
	const appPath = join(ROOT, 'packages/api/src/app.ts');
	if (existsSync(appPath)) {
		const out = readFileSync(appPath, 'utf8')
			.split('\n')
			.filter(
				(line) =>
					!line.includes("from './routes/oauth/index'") &&
					!line.includes(".route('/oauth', oauthRoutes)")
			)
			.join('\n');
		writeFileSync(appPath, out);
	}
	rmSync(join(ROOT, 'packages/web/src/lib/OAuthLogin.svelte'), { force: true });
	for (const page of [
		'packages/web/src/routes/(account)/login/+page.svelte',
		'packages/web/src/routes/(account)/register/+page.svelte'
	]) {
		const p = join(ROOT, page);
		if (!existsSync(p)) continue;
		const out = readFileSync(p, 'utf8')
			.split('\n')
			.filter((line) => !line.includes('OAuthLogin'))
			.join('\n');
		writeFileSync(p, out);
	}
}

function selfDestruct() {
	// Drop the `rebrand` script entry, then delete this file.
	const pkgPath = join(ROOT, 'package.json');
	if (existsSync(pkgPath)) {
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
		if (pkg.scripts && pkg.scripts.rebrand) {
			delete pkg.scripts.rebrand;
			writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
		}
	}
	rmSync(join(ROOT, SELF), { force: true });
}

function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (opts.help) {
		help();
		process.exit(0);
	}
	const scope = opts.scope.startsWith('@') ? opts.scope : '@' + opts.scope;
	const slug = opts.slug.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ak5';

	console.log(`\nRebranding in place:`);
	console.log(`  scope: ${scope}   slug: ${slug}   oauth: ${opts.oauth}\n`);

	if (!opts.oauth) {
		console.log('Removing OAuth overlay…');
		removeOAuthOverlay();
	}

	if (scope !== '@ak5' || slug !== 'ak5') {
		console.log('Applying token replacements…');
		walkReplace(ROOT, makeReplacer(scope, slug));
	} else {
		console.log('No --scope/--slug change — skipping token replacement.');
	}

	selfDestruct();

	if (opts.install) {
		console.log('\nReinstalling dependencies (package names changed)…\n');
		spawnSync('pnpm', ['install'], { cwd: ROOT, stdio: 'inherit' });
		console.log('\nFormatting…\n');
		spawnSync('pnpm', ['format'], { cwd: ROOT, stdio: 'inherit' });
	}

	console.log(`\nDone. This repo is now branded ${scope} / ${slug}.`);
	console.log('The rebrand script has removed itself. Next:');
	console.log('  pnpm -w run dev:init   # scaffold .env, rotate JWT_SECRET');
	console.log('  # paste a Neon DATABASE_URL into packages/api/.env, then:');
	console.log('  pnpm db:migrate && pnpm create:admin && pnpm dev\n');
}

main();
