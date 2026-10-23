import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
if (existsSync('.env')) process.loadEnvFile('.env');
const [platform, mode] = process.argv.slice(2);
if (!['ios', 'android'].includes(platform)) throw new Error('Expected ios or android');
const release = mode === 'release';
if (
	release &&
	(!process.env.MOBILE_API_URL?.startsWith('https://') ||
		!process.env.MOBILE_WEB_URL?.startsWith('https://'))
)
	throw new Error('Release builds require explicit HTTPS MOBILE_API_URL and MOBILE_WEB_URL');
let port;
if (!release) {
	const config = readFileSync('.env.dev-slot', 'utf8');
	port = config.match(/^RCT_METRO_PORT=(\d+)$/m)?.[1];
	if (!port) throw new Error('Start pnpm dev first to select a free Metro port');
}
const args = ['node_modules/react-native/cli.js', `run-${platform}`, '--no-packager'];
if (release) args.push('--mode', 'Release');
else args.push('--port', port);
const result = spawnSync('node', args, {
	stdio: 'inherit',
	env: { ...process.env, ...(port ? { RCT_METRO_PORT: port } : {}) }
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
