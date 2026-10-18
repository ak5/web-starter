import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const platform = process.argv[2];
if (!['ios', 'android'].includes(platform)) throw new Error('Expected ios or android');
const destination = resolve('../../tmp/mobile/bundles', platform);
mkdirSync(destination, { recursive: true });
const result = spawnSync(
	'node',
	[
		'node_modules/react-native/cli.js',
		'bundle',
		'--config',
		'metro.config.cjs',
		'--platform',
		platform,
		'--entry-file',
		'index.js',
		'--dev',
		'false',
		'--bundle-output',
		`${destination}/main.jsbundle`,
		'--assets-dest',
		destination,
		'--max-workers',
		'1'
	],
	{ stdio: 'inherit' }
);
if (result.status !== 0) process.exit(result.status ?? 1);
// Metro output must also compile for the native runtime; JavaScript bundling alone misses unsupported syntax.
const require = createRequire(import.meta.url);
const host = { darwin: 'osx-bin', linux: 'linux64-bin', win32: 'win64-bin' }[process.platform];
if (!host) throw new Error('Unsupported Hermes compiler host');
const compiler = resolve(
	dirname(require.resolve('hermes-compiler/package.json')),
	'hermesc',
	host,
	process.platform === 'win32' ? 'hermesc.exe' : 'hermesc'
);
const bytecode = spawnSync(
	compiler,
	['-emit-binary', '-out', `${destination}/main.hbc`, `${destination}/main.jsbundle`],
	{ stdio: 'inherit' }
);
process.exit(bytecode.status ?? 1);
