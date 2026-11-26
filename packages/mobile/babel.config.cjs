const expoPreset = require.resolve('expo/internal/babel-preset');

module.exports = {
	presets: [expoPreset],
	overrides: [
		{
			// The SQL migrator's filesystem loader is unused on mobile and Metro requires literal imports.
			test: (filename) =>
				Boolean(filename && /[/\\]effect[/\\]dist[/\\]sql[/\\]Migrator\.js$/.test(filename)),
			presets: [[expoPreset, { disableImportExportTransform: false }]],
			plugins: ['@babel/plugin-transform-dynamic-import']
		}
	]
};
