import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
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
process.exit(result.status ?? 1);
