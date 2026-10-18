const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
// Disable browser DOM debug patches on the native Hermes runtime.
const esmEnvFalseFile = path.join(path.dirname(require.resolve('esm-env')), 'false.js');

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
	watchFolders: [
		path.resolve(projectRoot, '../../node_modules'),
		path.resolve(projectRoot, '../shared'),
		path.resolve(projectRoot, '../sync')
	],
	maxWorkers: 1,
	transformer: {
		babelTransformerPath: require.resolve('@symbiote-native/svelte/metro-svelte-transformer'),
		// Svelte reactivity cannot initialize correctly with lazy inline requires.
		getTransformOptions: async () => ({
			transform: { experimentalImportSupport: false, inlineRequires: false }
		})
	},
	resolver: {
		useWatchman: false,
		nodeModulesPaths: [
			path.join(projectRoot, 'node_modules'),
			path.resolve(projectRoot, '../../node_modules')
		],
		sourceExts: [...defaultConfig.resolver.sourceExts, 'svelte', 'css'],
		// Native still needs Svelte’s client runtime rather than its SSR entry.
		unstable_conditionNames: ['react-native', 'browser'],
		resolveRequest: (context, moduleName, platform) => {
			if (moduleName === 'esm-env/development') {
				return { type: 'sourceFile', filePath: esmEnvFalseFile };
			}
			return context.resolveRequest(context, moduleName, platform);
		},
		unstable_forceFullRefreshPatterns: [/\.svelte$/]
	}
};

module.exports = mergeConfig(defaultConfig, config);
