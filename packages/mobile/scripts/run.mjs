import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadMobileEnvironment } from './environment.mjs';

loadMobileEnvironment();
const [platform, ...options] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform)) throw new Error('Expected ios or android');
const release = options[0] === 'release';
if (release && !process.env.EXPO_PUBLIC_MOBILE_API_URL?.startsWith('https://'))
	throw new Error('Release builds require explicit HTTPS MOBILE_API_URL');
const args = [`run:${platform}`, ...(release ? options.slice(1) : options)];
const env = { ...process.env };
if (release) {
	args.push(
		'--no-bundler',
		...(platform === 'ios' ? ['--configuration', 'Release'] : ['--variant', 'release'])
	);
} else {
	const config = existsSync('.env.dev-slot') ? readFileSync('.env.dev-slot', 'utf8') : '';
	const port = config.match(/^RCT_METRO_PORT=(\d+)$/m)?.[1];
	if (!port) throw new Error('Start pnpm dev:app first to select a free Metro port');
	const status = await fetch(`http://127.0.0.1:${port}/status`, {
		signal: AbortSignal.timeout(5000)
	}).catch(() => null);
	if (
		!status?.ok ||
		status.headers.get('X-React-Native-Project-Root') !== encodeURI(realpathSync('.')) ||
		(await status.text().catch(() => '')) !== 'packager-status:running'
	)
		throw new Error(
			`Metro is not ready for this mobile project on port ${port}. Run pnpm dev:app.`
		);
	// Expo reuses Metro on this port when it belongs to the current project.
	args.push('--port', port);
	env.RCT_METRO_PORT = port;
}
const result = spawnSync('expo', args, { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
