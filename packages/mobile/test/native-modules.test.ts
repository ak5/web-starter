import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

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
			modules: { packageName: string; modules?: unknown[]; projects?: { modules: unknown[] }[] }[];
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
			assert.ok(classes?.length, `${name} must expose native modules on ${platform}`);
		}
	});
}
