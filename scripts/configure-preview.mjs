import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function configurePreview(config, number) {
	assert.match(number ?? '', /^[1-9][0-9]*$/, 'PR_NUMBER must be a positive integer');
	const staging = config.env.staging;
	const api = staging.vars.PUBLIC_API_URL;
	assert.ok(api.startsWith('https://') && api.includes('-api-stg.'), 'Expected staging API URL');
	const previewName = (name) => name.replace(/-stg$/, `-pr-${number}`);
	staging.name = previewName(staging.name);
	for (const key of ['PUBLIC_API_URL', 'PUBLIC_APP_URL', 'PUBLIC_ADMIN_URL']) {
		if (key in staging.vars)
			staging.vars[key] = staging.vars[key].replace('-stg.', `-pr-${number}.`);
	}
	for (const service of staging.services ?? []) service.service = previewName(service.service);
	assert.ok(!staging.routes.length, 'Previews must have no production routes');
	assert.ok(staging.name.endsWith(`-pr-${number}`));
	return config;
}

if (process.argv[2] === '--test') {
	const fixture = () => ({
		env: {
			staging: {
				name: 'app-web-stg',
				routes: [],
				vars: {
					PUBLIC_API_URL: 'https://app-api-stg.example.workers.dev',
					PUBLIC_APP_URL: 'https://app-web-stg.example.workers.dev',
					PUBLIC_ADMIN_URL: 'https://app-admin-stg.example.workers.dev'
				},
				services: [{ binding: 'API', service: 'app-api-stg' }]
			}
		}
	});
	const staging = configurePreview(fixture(), '42').env.staging;
	assert.equal(staging.name, 'app-web-pr-42');
	assert.equal(staging.vars.PUBLIC_API_URL, 'https://app-api-pr-42.example.workers.dev');
	assert.equal(staging.services[0].service, 'app-api-pr-42');
	assert.throws(() => configurePreview(fixture(), '../main'));
	const unsafe = fixture();
	unsafe.env.staging.routes.push({ pattern: 'prod.example.com' });
	assert.throws(() => configurePreview(unsafe, '42'));
	for (const app of ['api', 'web', 'admin']) {
		const config = JSON.parse(
			readFileSync(`packages/${app}/wrangler.jsonc`, 'utf8').replace(/^\s*\/\/.*$/gm, '')
		);
		const preview = configurePreview(config, '42').env.staging;
		assert.ok(preview.name.endsWith(`-${app}-pr-42`));
		assert.ok(preview.vars.PUBLIC_API_URL.includes('-api-pr-42.'));
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
