import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

function assetOrigin(raw) {
	const url = URL.parse(raw ?? '');
	assert.ok(
		url?.protocol === 'https:' &&
			!url.username &&
			!url.password &&
			url.pathname === '/' &&
			!url.search &&
			!url.hash,
		"Set R2_PUBLIC_URL to this environment's HTTPS bucket origin."
	);
	return url.origin;
}

if (process.argv[2] === '--test') {
	assert.equal(assetOrigin('https://assets.example.test/'), 'https://assets.example.test');
	for (const value of [
		undefined,
		'http://assets.example.test',
		'https://assets.example.test/uploads',
		'https://user@assets.example.test',
		'https://assets.example.test/?key=value',
		'https://assets.example.test/#uploads'
	]) {
		assert.throws(() => assetOrigin(value));
	}
} else {
	const target = process.env.TARGET || 'development';
	if (target !== 'production') {
		assert.ok(target === 'development' || target === 'staging', 'Invalid deployment target.');
		const path = 'packages/api/wrangler.jsonc';
		const config = JSON.parse(readFileSync(path, 'utf8'));
		config.env[target].vars.PUBLIC_R2_URL = assetOrigin(process.env.R2_PUBLIC_URL);
		writeFileSync(path, JSON.stringify(config, null, '\t') + '\n');
	}
}
