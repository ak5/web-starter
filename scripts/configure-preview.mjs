import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function configurePreview(config, number) {
	assert.match(number ?? '', /^[1-9][0-9]*$/, 'PR_NUMBER must be a positive integer');
	const development = config.env.development;
	const api = development.vars.PUBLIC_API_URL;
	assert.ok(
		api.startsWith('https://') && new URL(api).hostname.endsWith('.workers.dev'),
		'Expected development API URL'
	);
	const previewName = (name) => name.replace(/-[^-]+$/, `-pr-${number}`);
	for (const binding of development.durable_objects?.bindings ?? []) {
		// Shared D1 needs a single ordering authority across development and previews.
		binding.script_name = development.name;
	}
	development.name = previewName(development.name);
	if ('PUBLIC_DEPLOY_ENVIRONMENT' in development.vars)
		development.vars.PUBLIC_DEPLOY_ENVIRONMENT = `Preview PR #${number}`;
	for (const key of ['PUBLIC_API_URL', 'PUBLIC_APP_URL', 'PUBLIC_ADMIN_URL']) {
		if (key in development.vars) {
			const url = new URL(development.vars[key]);
			const [worker, ...domain] = url.hostname.split('.');
			url.hostname = [previewName(worker), ...domain].join('.');
			development.vars[key] = url.origin;
		}
	}
	for (const service of development.services ?? []) service.service = previewName(service.service);
	assert.ok(!development.routes.length, 'Previews must have no production routes');
	assert.ok(development.name.endsWith(`-pr-${number}`));
	return config;
}

if (process.argv[2] === '--test') {
	const fixture = () => ({
		env: {
			development: {
				name: 'app-web-dev',
				routes: [],
				vars: {
					PUBLIC_API_URL: 'https://app-api-dev.example.workers.dev',
					PUBLIC_APP_URL: 'https://app-web-dev.example.workers.dev',
					PUBLIC_ADMIN_URL: 'https://app-admin-dev.example.workers.dev'
				},
				services: [{ binding: 'API', service: 'app-api-dev' }]
			}
		}
	});
	const development = configurePreview(fixture(), '42').env.development;
	assert.equal(development.name, 'app-web-pr-42');
	assert.equal(development.vars.PUBLIC_API_URL, 'https://app-api-pr-42.example.workers.dev');
	assert.equal(development.services[0].service, 'app-api-pr-42');
	assert.throws(() => configurePreview(fixture(), '../main'));
	const unsafe = fixture();
	unsafe.env.development.routes.push({ pattern: 'prod.example.com' });
	assert.throws(() => configurePreview(unsafe, '42'));
	for (const app of ['api', 'web', 'admin']) {
		const config = JSON.parse(
			readFileSync(`packages/${app}/wrangler.jsonc`, 'utf8').replace(/^\s*\/\/.*$/gm, '')
		);
		const bindings = JSON.stringify(config.env.development.d1_databases);
		const syncScript = config.env.development.name;
		const preview = configurePreview(config, '42').env.development;
		assert.equal(JSON.stringify(preview.d1_databases), bindings);
		assert.ok(preview.name.endsWith(`-${app}-pr-42`));
		if (app === 'api') assert.equal(preview.durable_objects.bindings[0].script_name, syncScript);
		assert.ok(preview.vars.PUBLIC_API_URL.includes('-api-pr-42.'));
		if (app !== 'api') {
			assert.equal(preview.vars.PUBLIC_DEPLOY_ENVIRONMENT, 'Preview PR #42');
			assert.equal(preview.vars.PUBLIC_ENV_BANNER, 'true');
		}
	}
	console.log('Preview configuration checks passed');
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	for (const app of ['api', 'web', 'admin']) {
		const file = `packages/${app}/wrangler.jsonc`;
		const config = JSON.parse(readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, ''));
		writeFileSync(
			file,
			JSON.stringify(configurePreview(config, process.env.PR_NUMBER), null, '\t') + '\n'
		);
	}
}
