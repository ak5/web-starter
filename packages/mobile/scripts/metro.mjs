import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
async function free(port) {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once('error', (error) => {
			if (error.code === 'EADDRINUSE') resolve(false);
			else reject(error);
		});
		server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
	});
}
let port = 8081;
while (port < 8100 && !(await free(port))) port++;
if (port === 8100) throw new Error('No free Metro port in 8081–8099');
writeFileSync('.env.dev-slot', `RCT_METRO_PORT=${port}\nMETRO_URL=http://127.0.0.1:${port}\n`);
console.log(
	`Metro uses http://127.0.0.1:${port}; pass --port ${port} when launching a native app.`
);
const child = spawn(
	'node',
	[
		'node_modules/react-native/cli.js',
		'start',
		'--config',
		'metro.config.cjs',
		'--host',
		'127.0.0.1',
		'--port',
		String(port)
	],
	{ stdio: 'inherit', env: { ...process.env, RCT_METRO_PORT: String(port) } }
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
