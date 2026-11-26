import { readFileSync, writeFileSync } from 'node:fs';

const localOutput = process.argv[2];
const id = localOutput ? '00000000000000000000000000000001' : process.env.MCP_OAUTH_KV_NAMESPACE_ID;
if (!id) process.exit(0);
if (!/^[a-f0-9]{32}$/i.test(id)) throw new Error('Expected a dedicated MCP OAuth KV namespace ID.');

for (const name of localOutput ? ['api'] : ['api', 'web', 'admin']) {
	const path = `packages/${name}/wrangler.jsonc`;
	const config = JSON.parse(readFileSync(path, 'utf8'));
	const target = process.env.TARGET;
	const selected = localOutput || target === 'production' || !target ? config : config.env[target];
	if (name === 'api') {
		if (selected.kv_namespaces.some((namespace) => namespace.id === id))
			throw new Error('MCP OAuth must use a separate KV namespace.');
		selected.kv_namespaces.push({ binding: 'OAUTH_KV', id });
	} else {
		selected.vars.MCP_ENABLED = 'true';
	}
	writeFileSync(localOutput ?? path, JSON.stringify(config, null, '\t') + '\n');
}
