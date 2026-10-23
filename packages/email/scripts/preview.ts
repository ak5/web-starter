/**
 * React Email preview server. Renders the templates with their `PreviewProps`
 * defaults at http://preview.ak5.localhost:8354.
 *
 * Run via `pnpm --filter @ak5/email preview`.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, '..', 'src', 'templates');

const port = process.env.PORT ?? '8354';

// react-email shells out to its own dev server pointed at our templates dir.
const child = spawn('pnpm', ['exec', 'email', 'dev', '--dir', templatesDir, '--port', port], {
	stdio: 'inherit',
	env: process.env
});

child.on('exit', (code) => process.exit(code ?? 0));
