import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

test('native iOS React and Hermes locks match the installed JavaScript host', () => {
	const root = new URL('../', import.meta.url);
	const reactNative = JSON.parse(
		readFileSync(new URL('node_modules/react-native/package.json', root), 'utf8')
	);
	const hermes = JSON.parse(
		readFileSync(new URL('node_modules/hermes-compiler/package.json', root), 'utf8')
	);
	const lock = readFileSync(new URL('ios/Podfile.lock', root), 'utf8');
	assert.equal(lock.match(/^ {2}- React-Core \(([^)]+)\):/m)?.[1], reactNative.version);
	const prebuilt = lock.match(/^ {2}- React-Core-prebuilt \(([^)]+)\):/m)?.[1];
	if (prebuilt) assert.equal(prebuilt, reactNative.version);
	assert.equal(lock.match(/^ {2}- hermes-engine \(([^)]+)\):/m)?.[1], hermes.version);
});

for (const platform of ['apple', 'android']) {
	test(`resolves the actual native modules needed by SQLite and authentication on ${platform}`, () => {
		const result = spawnSync(
			process.execPath,
			[
				'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
				'resolve',
				'--platform',
				platform,
				'--json'
			],
			{ cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 30_000 }
		);
		assert.equal(result.status, 0, result.stderr);
		const resolved = JSON.parse(result.stdout) as {
			modules: {
				packageName: string;
				modules?: unknown[];
				pods?: { podspecDir: string }[];
				projects?: { modules: unknown[]; sourceDir: string }[];
			}[];
		};
		for (const name of [
			'expo',
			'expo-application',
			'expo-asset',
			'expo-constants',
			'expo-crypto',
			'expo-secure-store',
			'expo-sqlite'
		]) {
			const module = resolved.modules.find((value) => value.packageName === name);
			const classes =
				platform === 'apple'
					? module?.modules
					: module?.projects?.flatMap((project) => project.modules);
			const annotated = {
				'expo-application': ['Application', 'ExpoApplication'],
				'expo-sqlite': ['SQLite', 'ExpoSQLite']
			} as const;
			if (name in annotated) {
				const [prefix, nativeName] = annotated[name as keyof typeof annotated];
				const nativeRoot =
					platform === 'apple' ? module?.pods?.[0]?.podspecDir : module?.projects?.[0]?.sourceDir;
				assert.ok(nativeRoot, `${name} must have a native build target on ${platform}`);
				const source =
					platform === 'apple'
						? `${prefix}Module.swift`
						: `src/main/java/expo/modules/${prefix.toLowerCase()}/${prefix}Module.kt`;
				assert.match(
					readFileSync(join(nativeRoot, source), 'utf8'),
					new RegExp(`@ExpoModule\\(\\s*(?:name\\s*=\\s*)?"${nativeName}"`),
					`${name} must declare its Expo Modules 2 registration`
				);
				if (platform === 'android') {
					assert.match(readFileSync(join(nativeRoot, 'build.gradle'), 'utf8'), /v2\s+true/);
				}
				continue;
			}
			assert.ok(classes?.length, `${name} must expose native modules on ${platform}`);
		}
	});
}
