import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { emailPreview } from './scripts/preview.js';

export default defineConfig({
	plugins: [svelte(), emailPreview()],
	ssr: {
		noExternal: ['@better-svelte-email/components'],
		external: ['@better-svelte-email/server', 'svelte']
	},
	build: {
		// Declaration and bundle watchers share dist during development.
		emptyOutDir: !process.argv.includes('--watch'),
		ssr: 'src/index.ts',
		target: 'es2022',
		sourcemap: true,
		rolldownOptions: { output: { entryFileNames: 'index.js' } }
	}
});
