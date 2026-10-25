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
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setMobileEnabled } from './mobile.mjs';
import { makeReplacer, walkReplace } from './branding.mjs';

const ROOT = process.cwd();
const SELF = 'scripts/init.mjs'; // skip self during replace; deleted at the end

function parseArgs(argv) {
	const opts = { scope: '@ak5', slug: 'ak5', oauth: true, install: true, mobile: true };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--scope') opts.scope = argv[++i];
		else if (a === '--slug') opts.slug = argv[++i];
		else if (a === '--no-mobile') opts.mobile = false;
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
  --no-mobile        remove mobile source; restore later from the pinned starter
  --no-oauth         remove the Discord OAuth-login overlay
  --no-install       skip the post-rebrand \`pnpm install\`
`);
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
			if (pkg.scripts['test:unit'])
				pkg.scripts['test:unit'] = pkg.scripts['test:unit'].replace(' scripts/init.test.mjs', '');
			writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
		}
	}
	rmSync(join(ROOT, SELF), { force: true });
	rmSync(join(ROOT, 'scripts/init.test.mjs'), { force: true });
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

	const templatePath = join(ROOT, '.starter-template.json');
	if (existsSync(templatePath)) {
		const template = JSON.parse(readFileSync(templatePath, 'utf8'));
		writeFileSync(templatePath, JSON.stringify({ ...template, scope, slug }, null, '\t') + '\n');
	}
	if (!opts.mobile) setMobileEnabled(ROOT, false);

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
	console.log('  # initialize the local D1 schema, then:');
	console.log('  pnpm db:migrate && pnpm create:admin && pnpm dev:auto\n');
}

main();
