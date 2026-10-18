import type { Config } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

function readSlotEnv() {
	let dir = process.cwd();

	while (true) {
		const file = join(dir, '.env.dev-slot');

		if (existsSync(file)) {
			return Object.fromEntries(
				readFileSync(file, 'utf8')
					.split(/\r?\n/)
					.filter((line) => line && !line.startsWith('#') && line.includes('='))
					.map((line) => {
						const index = line.indexOf('=');

						return [line.slice(0, index), line.slice(index + 1)];
					})
			);
		}

		const parent = dirname(dir);

		if (parent === dir) return {};

		dir = parent;
	}
}

const slotEnv = readSlotEnv();
const apiOrigin =
	process.env.PUBLIC_API_URL ?? slotEnv.PUBLIC_API_URL ?? 'http://api.ak5.localhost:8359';
type CspSources = NonNullable<NonNullable<Config['csp']>['directives']>['connect-src'];
const apiOrigins = Array.from(
	new Set([new URL(apiOrigin).origin, 'https://api.ak5web.com'])
) as NonNullable<CspSources>;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: [vitePreprocess()],
			dynamicCompileOptions: ({ filename }) => {
				const relativePath = relative(import.meta.dirname, filename);
				const pathSegments = relativePath.toLowerCase().split(sep);

				return pathSegments.includes('node_modules') ? undefined : { runes: true };
			},
			adapter: adapter(),
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'blob:', 'data:', 'https://cdn.ak5web.com'],
					'font-src': ['self'],
					// Web pages call the api worker on its own origin via the hc client.
					'connect-src': ['self', ...apiOrigins],
					'frame-src': ['none'],
					'object-src': ['none'],
					'base-uri': ['self'],
					// OAuth-login forms may 303 to the api origin to start the provider flow.
					'form-action': ['self', ...apiOrigins]
				}
			}
		})
	],
	server: { allowedHosts: true, strictPort: true },
	ssr: {
		// Workspace packages ship TS source with `.js` import specifiers
		// (exports → src/, resolved by the bundler). Vite must transform them
		// rather than externalize, or Node's dev SSR loader can't map the
		// `.js` specifiers back to the real `.ts` files.
		noExternal: [/^@ak5\//]
	}
});
