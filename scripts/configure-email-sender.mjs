import { readFileSync, writeFileSync } from 'node:fs';

const sender = process.env.EMAIL_FROM?.trim();
if (sender && !/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sender)) {
	throw new Error('EMAIL_FROM must be a valid verified sender address when set.');
}

const path = process.argv[2] ?? 'packages/api/wrangler.jsonc';
const config = JSON.parse(readFileSync(path, 'utf8'));
for (const environment of [config, ...Object.values(config.env ?? {})]) {
	if (sender) {
		environment.vars.PUBLIC_EMAIL_FROM = sender;
		for (const binding of environment.send_email ?? []) {
			binding.allowed_sender_addresses = binding.allowed_sender_addresses?.map((address) =>
				address === '__EMAIL_FROM__' ? sender : address
			);
		}
	} else {
		delete environment.vars.PUBLIC_EMAIL_FROM;
		delete environment.send_email;
	}
}
writeFileSync(path, JSON.stringify(config, null, '\t') + '\n');
