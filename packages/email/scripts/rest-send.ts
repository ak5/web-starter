import { EmailDeliveryError } from '../src/send.js';

/** Diagnostic for senders outside Workers. Runtime applications use the EMAIL binding. */
export async function sendRestTestEmail(config: {
	accountId: string;
	apiToken: string;
	from: string;
	fromName: string;
	to: string;
	subject: string;
	html: string;
}): Promise<'delivered' | 'queued'> {
	try {
		if (!/^[a-f0-9]{32}$/i.test(config.accountId) || !config.apiToken) {
			throw new EmailDeliveryError('MISSING_REST_CREDENTIALS');
		}
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: { address: config.from, name: config.fromName },
					to: config.to,
					subject: config.subject,
					html: config.html
				}),
				signal: AbortSignal.timeout(15_000)
			}
		);
		if (!response.ok) throw new EmailDeliveryError(`HTTP_${response.status}`);
		const data = (await response.json()) as {
			success?: unknown;
			result?: { delivered?: string[]; queued?: string[]; permanent_bounces?: string[] };
		} | null;
		if (data?.success !== true || data.result?.permanent_bounces?.includes(config.to)) {
			throw new EmailDeliveryError('REST_NOT_ACCEPTED');
		}
		if (data.result?.delivered?.includes(config.to)) return 'delivered';
		if (data.result?.queued?.includes(config.to)) return 'queued';
		throw new EmailDeliveryError('REST_NOT_ACCEPTED');
	} catch (error) {
		const code = error instanceof EmailDeliveryError ? error.code : 'SEND_FAILED';
		console.error(
			JSON.stringify({ event: 'email.delivery_failed', transport: 'cloudflare-rest', code })
		);
		throw new EmailDeliveryError(code);
	}
}
