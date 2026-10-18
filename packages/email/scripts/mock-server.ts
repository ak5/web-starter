/**
 * In-memory mock email server. Mimics the transactional email API's POST /send
 * contract, captures every email sent in dev, and exposes inspection endpoints
 * used by the CLI (`pnpm cli emails *`) and by Playwright tests.
 *
 * Endpoints:
 *   POST /send                            — accept an email (returns { recipient, success: true })
 *   GET  /emails                          — list every captured email (newest first)
 *   GET  /emails/to/:address              — list emails sent to one recipient
 *   GET  /emails/to/:address/pin          — extract the verification PIN from the latest email
 *   GET  /emails/to/:address/magic-link   — extract the magic-link URL + token from the latest email
 *   DELETE /emails                        — clear the buffer (used between Playwright runs)
 *
 * Run via `pnpm --filter @ak5/email mock`. Defaults to port 8355.
 */
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

interface CapturedEmail {
	id: string;
	to: string;
	from: string;
	from_name?: string;
	subject: string;
	html: string;
	receivedAt: string;
}

const inbox: CapturedEmail[] = [];

const app = new Hono();

app.post('/send', async (c) => {
	const body = (await c.req.json()) as Omit<CapturedEmail, 'id' | 'receivedAt'>;
	const captured: CapturedEmail = {
		id: crypto.randomUUID(),
		to: body.to,
		from: body.from,
		from_name: body.from_name,
		subject: body.subject,
		html: body.html,
		receivedAt: new Date().toISOString()
	};
	inbox.unshift(captured);
	return c.json({ recipient: body.to, success: true });
});

app.get('/emails', (c) => c.json(inbox));

app.get('/emails/to/:address', (c) => {
	const address = c.req.param('address');
	return c.json(inbox.filter((e) => e.to === address));
});

app.get('/emails/to/:address/pin', (c) => {
	const address = c.req.param('address');
	const latest = inbox.find((e) => e.to === address);
	if (!latest) return c.json({ error: 'no email' }, 404);
	// PIN extraction: alnum block inside <Text style="font-family:monospace...">PIN</Text>
	const pin = latest.html.match(/font-family:\s*monospace[^>]*>\s*([A-Za-z0-9]{4,8})\s*</)?.[1];
	if (!pin) return c.json({ error: 'no pin found' }, 404);
	return c.json({ pin, emailId: latest.id });
});

app.get('/emails/to/:address/magic-link', (c) => {
	const address = c.req.param('address');
	const latest = inbox.find((e) => e.to === address);
	if (!latest) return c.json({ error: 'no email' }, 404);
	// Match the first href that carries a token query param.
	const url = latest.html.match(/href="(https?:\/\/[^"]+\?t=[^"]+)"/)?.[1];
	if (!url) return c.json({ error: 'no magic link found' }, 404);
	const token = new URL(url).searchParams.get('t');
	return c.json({ url, token, emailId: latest.id });
});

app.delete('/emails', (c) => {
	inbox.length = 0;
	return c.json({ cleared: true });
});

const port = Number(process.env.PORT ?? 8355);
serve({ fetch: app.fetch, port }, (info) => {
	console.log(`mock email server listening on http://localhost:${info.port}`);
});
