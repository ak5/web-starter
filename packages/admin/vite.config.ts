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
								LOCAL_API_URL: `http://127.0.0.1:${process.env.AK5_API_PORT ?? '8350'}`
							}
						})
					: undefined
			}),
			tailwindcss(),
			reactRouter()
		],
		server: { allowedHosts: true, strictPort: true },
		preview: { allowedHosts: true, strictPort: true },
		resolve: { dedupe: ['react', 'react-dom', 'react-router'] },
		optimizeDeps: { entries: ['src/root.tsx', 'src/routes/*.tsx'] }
	};
});
