import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: [
			'dist/**',
			'build/**',
			'.wrangler/**',
			'.react-router/**',
			'worker-configuration.d.ts'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	{
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	}
);
