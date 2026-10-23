const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const envFile = resolve(__dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const slotFile = resolve(__dirname, '../../.env.dev-slot');
const slot = existsSync(slotFile) ? readFileSync(slotFile, 'utf8') : '';
const flags = {
	'process.env.DEBUG': process.env.DEBUG === '1' ? '1' : '0',
	'process.env.MOBILE_WEB_URL': process.env.MOBILE_WEB_URL || '',
	'process.env.MOBILE_API_URL': process.env.MOBILE_API_URL || '',
	'process.env.MOBILE_API_PORT': slot.match(/^AK5_API_PORT=(\d+)$/m)?.[1] || '8350'
};
function inlineFlags({ types: t }) {
	return {
		name: 'inline-flags',
		visitor: {
			// Effect also reads import.meta?.env, which the Vite-env plugin does not transform.
			OptionalMemberExpression(path) {
				if (
					t.isMetaProperty(path.node.object) &&
					t.isIdentifier(path.node.property, { name: 'env' })
				) {
					path.replaceWith(t.memberExpression(t.identifier('process'), t.identifier('env')));
				}
			},
			MemberExpression(path) {
				for (const [name, value] of Object.entries(flags)) {
					if (path.matchesPattern(name)) path.replaceWith(t.stringLiteral(value));
				}
			}
		}
	};
}
module.exports = {
	presets: ['module:@react-native/babel-preset'],
	plugins: [
		'@babel/plugin-transform-export-namespace-from',
		'@babel/plugin-transform-dynamic-import',
		'babel-plugin-transform-vite-meta-env',
		inlineFlags
	]
};
