import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	{ ignores: ['dist/', 'ios/', 'android/', 'node_modules/'] },
	js.configs.recommended,
	...ts.configs.recommended,
	prettier,
	{
		files: ['**/*.{js,cjs,mjs}'],
		languageOptions: { globals: globals.node },
		rules: { '@typescript-eslint/no-require-imports': 'off' }
	},
	{
		files: ['**/*.{ts,tsx}'],
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	}
);
