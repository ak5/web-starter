import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
	const local = command === 'serve' || mode === 'local-preview';
	return {
		build: { license: { fileName: 'third-party-licenses.txt' } },
		plugins: [
			cloudflare({
				viteEnvironment: { name: 'ssr' },
				inspectorPort: false,
				config: local
					? (config) => ({
							services: mode === 'local-preview' ? [] : config.services,
							vars: {
								...config.vars,
								...(process.env.AK5_MCP_LOCAL === '1' && {
									MCP_ENABLED: 'true',
									MCP_LOCAL: 'true'
								}),
								LOCAL_API_URL: `http://127.0.0.1:${process.env.AK5_API_PORT ?? '8350'}`
							}
						})
					: undefined
			}),
			tailwindcss(),
			reactRouter()
		],
		server: {
			allowedHosts: true,
			strictPort: true,
			headers: {
				'Cross-Origin-Opener-Policy': 'same-origin',
				'Cross-Origin-Embedder-Policy': 'credentialless'
			}
		},
		preview: { allowedHosts: true, strictPort: true },
		resolve: { dedupe: ['react', 'react-dom', 'react-router'] },
		worker: { format: 'es' },
		optimizeDeps: {
			entries: ['src/root.tsx', 'src/routes/*.tsx', 'src/lib/notes/*.ts'],
			include: [
				'@livestore/livestore',
				'@livestore/adapter-web',
				'@livestore/adapter-web/worker',
				'@livestore/adapter-web/shared-worker',
				'@ak5/sync > @livestore/sync-cf/client',
				'@ak5/sync > effect'
			],
			exclude: ['@livestore/wa-sqlite']
		}
	};
});
