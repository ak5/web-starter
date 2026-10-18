/**
 * Send one test email through the same render + send path used by the app.
 *
 * Local mock:
 *   pnpm --filter @ak5/email test:send --to test@example.com --mock-url http://localhost:8355
 *
 * Cloudflare REST diagnostic (outside Workers):
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm --filter @ak5/email test:send --real --to you@example.com \
 *     --from sender@example.com
 */
import { renderTemplate, sendTemplate, type EmailLogger } from '../src/send.js';

import { sendRestTestEmail } from './rest-send.js';

interface Options {
	to?: string;
	from: string;
	fromName: string;
	appUrl: string;
	mockUrl?: string;
	real: boolean;
}

const logger: EmailLogger = {
	log(level, message, data) {
		console.log(JSON.stringify({ level, message, ...data }));
	}
};

function usage(exitCode = 0): never {
	console.log(`Usage:
  pnpm --filter @ak5/email test:send --to <address> [--mock-url <url>]
  CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... pnpm --filter @ak5/email test:send --real --to <address> --from <verified-sender>

Options:
  --real             Send through Cloudflare REST (requires Email Sending:Edit). Without this, the local mock is used.
  --to <address>     Recipient. Defaults to TEST_EMAIL_TO.
  --from <address>   Sender. Defaults to PUBLIC_EMAIL_FROM or robot@ak5web.com.
  --from-name <name> Sender display name. Defaults to ak5-web.
  --app-url <url>    Link base URL. Defaults to PUBLIC_APP_URL or https://www.ak5web.com.
  --mock-url <url>   Local mock URL. Defaults to EMAIL_MOCK_URL or http://localhost:8355.`);
	process.exit(exitCode);
}

function readOptions(): Options {
	const args = process.argv.slice(2);
	const options: Options = {
		to: process.env.TEST_EMAIL_TO,
		from: process.env.PUBLIC_EMAIL_FROM ?? 'robot@ak5web.com',
		fromName: process.env.EMAIL_FROM_NAME ?? 'ak5-web',
		appUrl: process.env.PUBLIC_APP_URL ?? 'https://www.ak5web.com',
		mockUrl: process.env.EMAIL_MOCK_URL ?? 'http://localhost:8355',
		real: false
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '-h' || arg === '--help') usage(0);
		if (arg === '--real') {
			options.real = true;
			continue;
		}
		if (arg === '--to') {
			options.to = args[++index];
			continue;
		}
		if (arg === '--from') {
			options.from = args[++index] ?? options.from;
			continue;
		}
		if (arg === '--from-name') {
			options.fromName = args[++index] ?? options.fromName;
			continue;
		}
		if (arg === '--app-url') {
			options.appUrl = args[++index] ?? options.appUrl;
			continue;
		}
		if (arg === '--mock-url') {
			options.mockUrl = args[++index] ?? options.mockUrl;
			continue;
		}
		console.error(`Unknown argument: ${arg}`);
		usage(1);
	}

	if (!options.to) {
		console.error('Missing recipient. Pass --to or set TEST_EMAIL_TO.');
		usage(1);
	}

	return options;
}

async function main() {
	const options = readOptions();
	const props = { pin: 'T3ST42', appUrl: options.appUrl };
	let status: string;
	if (options.real) {
		const { html, subject } = await renderTemplate('VerifyEmail', props);
		status = await sendRestTestEmail({
			accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
			apiToken: process.env.CLOUDFLARE_API_TOKEN ?? '',
			from: options.from,
			fromName: options.fromName,
			to: options.to!,
			subject,
			html
		});
	} else {
		await sendTemplate(
			{
				fromAddress: options.from,
				fromName: options.fromName,
				mockApiUrl: options.mockUrl
			},
			'VerifyEmail',
			options.to!,
			props,
			logger
		);
		status = 'captured';
	}

	console.log(
		JSON.stringify({
			ok: true,
			mode: options.real ? 'cloudflare-rest' : 'mock',
			status,
			inboxVerificationRequired: options.real
		})
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
