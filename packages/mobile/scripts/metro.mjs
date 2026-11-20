import net from 'node:net';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { loadMobileEnvironment } from './environment.mjs';

loadMobileEnvironment();
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
const child = spawn('expo', ['start', '--dev-client', '--localhost', '--port', String(port)], {
	stdio: 'inherit'
});
child.on('error', (error) => {
	throw error;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
