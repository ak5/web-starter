import { readdirSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

export function makeReplacer(scope, slug) {
	const envPrefix = slug.toUpperCase().replace(/[^A-Z0-9]/g, '') + '_';
	// Keep upstream links and author attribution intact when branding an application.
	const preserved =
		/((?:https:\/\/github\.com\/|github:)ak5\/web-starter|by \[ak5\]\(https:\/\/alexander\.verver\.is\)|<a class="link" href="https:\/\/alexander\.verver\.is">ak5<\/a>)/;
	return (text) =>
		text
			.split(preserved)
			.map((part, index) =>
				index % 2
					? part
					: part.split('@ak5').join(scope).split('AK5_').join(envPrefix).split('ak5').join(slug)
			)
			.join('');
}

export function walkReplace(dir, replace, relBase = '') {
	for (const entry of readdirSync(dir)) {
		if (IGNORE.has(entry)) continue;
		const abs = join(dir, entry);
		const rel = relBase ? `${relBase}/${entry}` : entry;
		// Replacement rules and upstream test fixtures retain their original tokens.
		if (['scripts/init.mjs', 'scripts/branding.mjs', 'scripts/mobile.test.mjs'].includes(rel))
			continue;
		const st = lstatSync(abs);
		if (st.isSymbolicLink()) continue;
		if (st.isDirectory()) {
			walkReplace(abs, replace, rel);
		} else if (isText(entry)) {
			const before = readFileSync(abs, 'utf8');
			const after = replace(before);
			if (after !== before) writeFileSync(abs, after);
		}
	}
}
