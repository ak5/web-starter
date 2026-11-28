import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'packages/api/wrangler.jsonc';
const config = JSON.parse(readFileSync(path, 'utf8'));
const target = process.env.TARGET || 'development';
assert.ok(['development', 'staging', 'production'].includes(target), 'Invalid deployment target.');
const selected = target === 'production' ? config : config.env[target];
const bucket = process.env.PRIVATE_ATTACHMENTS_BUCKET?.trim();
selected.r2_buckets = selected.r2_buckets.filter(
	({ binding }) => binding !== 'PRIVATE_ATTACHMENTS'
);
if (bucket) {
	assert.match(
		bucket,
		/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/,
		'Invalid private attachment bucket name.'
	);
	assert.ok(
		[config, ...Object.values(config.env)]
			.flatMap(({ r2_buckets }) => r2_buckets ?? [])
			.every(
				({ binding, bucket_name }) => binding === 'PRIVATE_ATTACHMENTS' || bucket_name !== bucket
			),
		'Use a dedicated private attachment bucket.'
	);
	selected.r2_buckets.push({ binding: 'PRIVATE_ATTACHMENTS', bucket_name: bucket });
}
writeFileSync(path, JSON.stringify(config, null, '\t') + '\n');
