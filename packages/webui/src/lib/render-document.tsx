import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext, type RouterContextProvider } from 'react-router';
import { themeScript } from './theme-script.js';
import { requestState } from './request-context.js';

export async function renderDocument(
	request: Request,
	status: number,
	headers: Headers,
	routerContext: EntryContext,
	context: RouterContextProvider,
	notes = false
) {
	const nonce = crypto.randomUUID();
	const apiUrl = requestState(context).env.PUBLIC_API_URL;
	const apiOrigin = apiUrl ? new URL(apiUrl).origin : '';
	const cdnHost = apiOrigin.replace(/^https:\/\/api\./, 'https://cdn.');
	const digest = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(themeScript))
	);
	const themeHash = "'sha256-" + btoa(String.fromCharCode(...digest)) + "'";
	const scripts = ["'self'", `'nonce-${nonce}'`, themeHash, notes && "'wasm-unsafe-eval'"].filter(
		Boolean
	);
	const connect = ["'self'", apiOrigin, import.meta.env.DEV && 'ws:'].filter(Boolean);
	headers.set('Content-Type', 'text/html; charset=utf-8');
	headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			'script-src ' + scripts.join(' '),
			"style-src 'self' 'unsafe-inline'",
			`img-src 'self' blob: data: https://cdn.ak5web.com ${cdnHost}`.trim(),
			"font-src 'self'",
			'connect-src ' + connect.join(' '),
			"frame-src 'none'",
			notes && "worker-src 'self' blob:",
			"object-src 'none'",
			"base-uri 'self'",
			`form-action 'self' ${apiOrigin}`.trim()
		]
			.filter(Boolean)
			.join('; ')
	);
	const body = await renderToReadableStream(
		<ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
		{ nonce, signal: request.signal }
	);
	return new Response(body, { status, headers });
}
