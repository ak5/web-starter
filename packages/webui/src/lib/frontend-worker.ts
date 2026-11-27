import { RouterContextProvider, type RequestHandler } from 'react-router';
import { parseCookie, signJwt, type JwtType } from '@ak5/shared';
import { renderMcpConsent } from './mcp-consent.js';
import { requestState, setRequestState, type FrontendEnv } from './request-context.js';

export function createFrontendWorker(
	handle: RequestHandler,
	isolate = false,
	role: JwtType = isolate ? 'user' : 'admin'
) {
	return {
		async fetch(request: Request, env: FrontendEnv) {
			const context = new RouterContextProvider();
			setRequestState(context, env);
			const url = new URL(request.url);
			const mcp = [
				'/mcp',
				'/oauth/authorize',
				'/oauth/token',
				'/oauth/register',
				'/oauth/disconnect',
				'/.well-known/oauth-authorization-server',
				'/.well-known/oauth-protected-resource',
				'/.well-known/oauth-protected-resource/mcp'
			].includes(url.pathname);
			const browserAction =
				!mcp || url.pathname === '/oauth/authorize' || url.pathname === '/oauth/disconnect';
			const response =
				browserAction && crossOriginAction(request)
					? new Response('Cross-site form submissions are forbidden.', { status: 403 })
					: mcp
						? await proxyMcp(request, url, role, requestState(context))
						: await handle(request, context);
			const headers = new Headers(response.headers);
			const containsToken = new URL(request.url).searchParams.has('t');
			if (mcp || response.status >= 400 || containsToken) headers.set('Cache-Control', 'no-store');
			headers.set('X-Frame-Options', 'DENY');
			headers.set('X-Content-Type-Options', 'nosniff');
			if (!headers.has('Referrer-Policy'))
				headers.set(
					'Referrer-Policy',
					containsToken ? 'no-referrer' : 'strict-origin-when-cross-origin'
				);
			headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
			if (isolate) {
				headers.set('Cross-Origin-Opener-Policy', 'same-origin');
				headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
			}
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers
			});
		}
	};
}

function crossOriginAction(request: Request) {
	if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return false;
	const origin = request.headers.get('origin');
	const type = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
	const form =
		type === 'application/x-www-form-urlencoded' ||
		type === 'multipart/form-data' ||
		type === 'text/plain';
	return (origin !== null || form) && origin !== new URL(request.url).origin;
}

async function proxyMcp(
	request: Request,
	url: URL,
	role: JwtType,
	state: ReturnType<typeof requestState>
) {
	const { JWT_SECRET, PUBLIC_API_URL } = state.env;
	if (state.env.MCP_ENABLED !== 'true' || !JWT_SECRET || !PUBLIC_API_URL)
		return new Response(null, { status: 404 });
	const path = url.pathname + url.search;
	const headers = new Headers(request.headers);
	headers.set(
		'X-Ak5-Mcp-Portal',
		await signJwt(
			'ak5-mcp-portal:' + JWT_SECRET,
			{
				sub: url.origin,
				name: request.method + ' ' + path,
				type: role,
				email: '',
				recentAuthAt: 0,
				emailConfirmed: false,
				hasPassword: false
			},
			30
		)
	);
	const upstream = new Request(new URL(path, PUBLIC_API_URL), request);
	const response = await state.fetch(new Request(upstream, { headers, redirect: 'manual' }));
	return url.pathname === '/oauth/authorize' &&
		response.headers.get('content-type')?.includes('application/json')
		? renderMcpConsent(response, parseCookie(request.headers.get('cookie'), 'theme'))
		: response;
}
