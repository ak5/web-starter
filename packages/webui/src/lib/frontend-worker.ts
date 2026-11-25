import { RouterContextProvider, type RequestHandler } from 'react-router';
import { setRequestState, type FrontendEnv } from './request-context.js';

export function createFrontendWorker(handle: RequestHandler, isolate = false) {
	return {
		async fetch(request: Request, env: FrontendEnv) {
			const context = new RouterContextProvider();
			setRequestState(context, env);
			const response = crossOriginAction(request)
				? new Response('Cross-site form submissions are forbidden.', { status: 403 })
				: await handle(request, context);
			const headers = new Headers(response.headers);
			const containsToken = new URL(request.url).searchParams.has('t');
			if (response.status >= 400 || containsToken) headers.set('Cache-Control', 'no-store');
			headers.set('X-Frame-Options', 'DENY');
			headers.set('X-Content-Type-Options', 'nosniff');
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
