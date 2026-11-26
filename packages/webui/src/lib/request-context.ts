import { createContext, type RouterContextProvider } from 'react-router';
import type { JwtPayload } from '@ak5/shared';

export interface FrontendEnv {
	JWT_SECRET?: string;
	PUBLIC_COOKIE_ORIGIN?: string;
	PUBLIC_API_URL?: string;
	PUBLIC_ENV_BANNER?: string;
	PUBLIC_DEPLOY_ENVIRONMENT?: string;
	LOCAL_API_URL?: string;
	MCP_ENABLED?: string;
	MCP_LOCAL?: string;
	API?: { fetch: typeof fetch };
}

export interface Session {
	auth: JwtPayload | null;
}

export interface RequestState {
	env: FrontendEnv;
	fetch: typeof fetch;
	cookies: Headers;
	session: Session;
}

const stateContext = createContext<RequestState>();

export function setRequestState(context: RouterContextProvider, env: FrontendEnv) {
	const localApiUrl = env.LOCAL_API_URL;
	const apiFetch: typeof fetch =
		env.API?.fetch.bind(env.API) ??
		(localApiUrl
			? (input, init) => {
					const request = new Request(input, init);
					const url = new URL(request.url);
					const upstream = new URL(localApiUrl);
					upstream.pathname = url.pathname;
					upstream.search = url.search;
					return fetch(new Request(upstream, request));
				}
			: fetch);
	context.set(stateContext, {
		env: env.MCP_LOCAL === 'true' ? { ...env, PUBLIC_COOKIE_ORIGIN: 'localhost' } : env,
		fetch: apiFetch,
		cookies: new Headers(),
		session: { auth: null }
	});
}

export function requestState(context: Readonly<RouterContextProvider>) {
	return context.get(stateContext);
}

export interface ApiRequestEvent {
	request: Request;
	url: URL;
	context: Readonly<RouterContextProvider>;
}
