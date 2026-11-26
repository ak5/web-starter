import { defineConfig } from 'vite';
import { emailPreview } from './scripts/preview.js';

export default defineConfig({
	plugins: [emailPreview()],
	build: {
		// Declaration and bundle watchers share dist during development.
		emptyOutDir: !process.argv.includes('--watch'),
		ssr: 'src/index.ts',
		target: 'es2022',
		sourcemap: true,
		rolldownOptions: { output: { entryFileNames: 'index.js' } }
	}
});
