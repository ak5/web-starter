import {
	OAuthProvider,
	AuthorizationError,
	OAuthError,
	type OAuthHelpers
} from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { registerTools } from './mcp-tools';
import { COOKIE_TOKEN, parseCookie, signJwt, verifyJwt, type JwtPayload } from '@ak5/shared';
import { sha256Hex } from './lib/tokens';
import { app } from './app';
import type { Env } from './types';

type Grant = Pick<
	JwtPayload,
	'sub' | 'type' | 'sessionVersion' | 'emailConfirmed' | 'hasPassword'
> & { write: boolean; audience: string };
export function mcpProvider(origin: string, role: Grant['type']) {
	return new OAuthProvider<Env>({
		apiRoute: '/mcp',
		authorizeEndpoint: '/oauth/authorize',
		tokenEndpoint: '/oauth/token',
		clientRegistrationEndpoint: '/oauth/register',
		accessTokenTTL: 3600,
		refreshTokenTTL: 30 * 86400,
		scopesSupported: ['ak5-web'],
		clientIdMetadataDocumentEnabled: false,
		onError: () => undefined,
		tokenExchangeCallback: async ({ props, env }) => {
			const grant = props as Grant;
			if (grant.type !== role || grant.audience !== origin + '/mcp')
				throw new OAuthError('invalid_grant', {
					description: 'Grant is not valid for this portal.'
				});
			const jwt = await signJwt(env.JWT_SECRET, { ...grant, email: '', recentAuthAt: 0 }, 60);
			const identity = await app.request(
				origin + '/auth/me',
				{ headers: { cookie: COOKIE_TOKEN + '=' + jwt } },
				env
			);
			if (!identity.ok)
				throw new OAuthError(identity.status >= 500 ? 'temporarily_unavailable' : 'invalid_grant', {
					description: 'The account could not be authorized.'
				});
		},
		resourceMetadata: { resource: origin + '/mcp', authorization_servers: [origin] },
		apiHandler: {
			async fetch(request, env, context) {
				const { write, audience, ...claims } = context.props as Grant;
				if (audience !== origin + '/mcp' || claims.type !== role)
					return new Response(null, { status: 403 });
				const token = await signJwt(env.JWT_SECRET, { ...claims, email: '', recentAuthAt: 0 }, 60);
				const headers = { cookie: COOKIE_TOKEN + '=' + token, 'content-type': 'application/json' };
				const identity = await app.request(origin + '/auth/me', { headers }, env, context);
				if (!identity.ok)
					return new Response(null, {
						status: identity.status === 403 ? 401 : identity.status,
						headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' }
					});
				const server = new McpServer({ name: 'ak5-web', version: '1.0.0' });
				registerTools(server, { type: claims.type, write }, async (path, method = 'GET', body) => {
					const response = await app.request(
						origin + path,
						{
							method,
							headers,
							signal: request.signal,
							body: body === undefined ? undefined : JSON.stringify(body)
						},
						env,
						context
					);
					const data = (await response.json().catch(() => null)) as {
						error?: string;
						message?: string;
					} | null;
					if (!response.ok)
						throw new Error(
							data?.error ?? data?.message ?? 'Starter API returned HTTP ' + response.status
						);
					return data;
				});
				const transport = new WebStandardStreamableHTTPServerTransport({
					enableJsonResponse: true
				});
				await server.connect(transport);
				return transport.handleRequest(request);
			}
		},
		defaultHandler: {
			async fetch(request, env, context) {
				const url = new URL(request.url);
				const oauth = (env as Env & { OAUTH_PROVIDER: OAuthHelpers }).OAUTH_PROVIDER;
				if (url.pathname === '/oauth/disconnect' && request.method === 'POST') {
					if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
					const cookie = parseCookie(request.headers.get('cookie'), COOKIE_TOKEN);
					const claims = cookie ? await verifyJwt(env.JWT_SECRET, cookie) : null;
					const identity = await app.request(
						origin + '/auth/me',
						{ headers: { cookie: request.headers.get('cookie') ?? '' } },
						env,
						context
					);
					if (claims?.type !== role || claims.impersonatedBy || !identity.ok)
						return new Response(null, { status: 401 });
					let cursor: string | undefined;
					do {
						const grants = await oauth.listUserGrants(claims.sub, { cursor });
						for (const grant of grants.items) await oauth.revokeGrant(grant.id, claims.sub);
						cursor = grants.cursor;
					} while (cursor);
					return new Response(null, {
						status: 303,
						headers: { Location: '/account/password?mcp=disconnected' }
					});
				}
				if (url.pathname !== '/oauth/authorize') return new Response(null, { status: 404 });
				const login = '/login?next=' + encodeURIComponent(url.pathname + url.search);
				try {
					if (!role || (request.method === 'POST' && request.headers.get('origin') !== origin))
						return new Response(null, { status: 403 });
					const cookies = request.headers.get('cookie') ?? '';
					const token = parseCookie(cookies, COOKIE_TOKEN);
					const claims = token ? await verifyJwt(env.JWT_SECRET, token) : null;
					const identity =
						claims?.type === role && !claims.impersonatedBy
							? await app.request(
									origin + '/auth/me',
									{ headers: { cookie: cookies } },
									env,
									context
								)
							: null;
					if (identity && identity.status >= 500)
						return Response.json({ state: 'unavailable' }, { status: 503 });

					if (request.method === 'GET') {
						const authorization = await oauth.parseAuthRequest(request);
						if (authorization.codeChallengeMethod !== 'S256')
							return Response.json({ state: 'expired' }, { status: 400 });
						const client = await oauth.describeConsent(authorization);
						if (!identity?.ok || !claims) {
							return Response.json({
								state: claims?.impersonatedBy ? 'impersonating' : 'signed-out',
								client: client.clientName,
								role,
								login
							});
						}
						const { handle, headers } = await oauth.beginConsent(authorization);
						return Response.json(
							{
								state: 'ready',
								role,
								client: client.clientName,
								email: claims.email,
								handle,
								binding: await consentBinding(env.JWT_SECRET, token!, handle),
								redirectHost: client.redirectHost,
								loopback: client.redirectIsLoopback,
								callbackOrigin: new URL(client.redirectUri).origin
							},
							{ headers }
						);
					}
					if (request.method !== 'POST') return new Response(null, { status: 405 });
					if (!identity?.ok || !claims) return Response.redirect(origin + login, 303);
					const reader = request.body?.getReader();
					if (!reader) return new Response(null, { status: 400 });
					let size = 0;
					let body = '';
					const decoder = new TextDecoder();
					for (;;) {
						const { value, done } = await reader.read();
						if (done) break;
						size += value.byteLength;
						if (size > 8192) {
							await reader.cancel();
							return new Response(null, { status: 413 });
						}
						body += decoder.decode(value, { stream: true });
					}
					const form = new URLSearchParams(body + decoder.decode());
					const handle = form.get('handle') ?? '';
					if (form.get('binding') !== (await consentBinding(env.JWT_SECRET, token!, handle)))
						return new Response(null, { status: 403 });

					if (form.get('decision') === 'deny') {
						const denied = await oauth.denyConsent(request, handle);
						return new Response(null, { status: 303, headers: denied.headers });
					}
					const access = form.get('access');
					if (form.get('decision') !== 'allow' || (access !== 'read' && access !== 'write'))
						return new Response(null, { status: 400 });
					const consent = await oauth.approveConsent(request, handle, {
						scope: ['ak5-web']
					});
					const { sub, type, sessionVersion, emailConfirmed, hasPassword } = claims;
					const result = await oauth.completeAuthorization({
						request: consent.request,
						userId: sub,
						metadata: {},
						scope: ['ak5-web'],
						props: {
							sub,
							type,
							sessionVersion,
							emailConfirmed,
							hasPassword,
							write: access === 'write',
							audience: origin + '/mcp'
						} satisfies Grant
					});
					consent.headers.set('Location', result.redirectTo);
					return new Response(null, { status: 303, headers: consent.headers });
				} catch (error) {
					if (error instanceof AuthorizationError)
						return Response.json({ state: 'expired' }, { status: 400 });
					throw error;
				}
			}
		}
	});
}

async function consentBinding(secret: string, session: string, handle: string) {
	return sha256Hex(JSON.stringify(['mcp-consent', secret, session, handle]));
}

export function isMcpPath(pathname: string) {
	return (
		pathname === '/mcp' ||
		['/oauth/authorize', '/oauth/token', '/oauth/register', '/oauth/disconnect'].includes(
			pathname
		) ||
		[
			'/.well-known/oauth-authorization-server',
			'/.well-known/oauth-protected-resource',
			'/.well-known/oauth-protected-resource/mcp'
		].includes(pathname)
	);
}

export async function handleMcp(request: Request, env: Env, ctx: ExecutionContext) {
	const url = new URL(request.url);
	const proof = request.headers.get('X-Ak5-Mcp-Portal');
	const portal =
		proof && env.OAUTH_KV && (await verifyJwt('ak5-mcp-portal:' + env.JWT_SECRET, proof));
	const configured =
		portal && (portal.type === 'admin' ? env.PUBLIC_ADMIN_URL : env.PUBLIC_APP_URL);
	if (
		!portal ||
		!env.OAUTH_KV ||
		!configured ||
		portal.sub !== new URL(configured).origin ||
		portal.name !== request.method + ' ' + url.pathname + url.search
	)
		return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

	const prefix = 'mcp:' + (await sha256Hex(portal.sub)) + ':';
	const namespace = env.OAUTH_KV;
	const scoped = {
		get: (key: string, options: KVNamespaceGetOptions<never>) =>
			namespace.get(prefix + key, options),
		put: (key: string, value: string, options?: KVNamespacePutOptions) =>
			namespace.put(prefix + key, value, options),
		delete: (key: string) => namespace.delete(prefix + key),
		async list(options?: KVNamespaceListOptions) {
			const result = await namespace.list({ ...options, prefix: prefix + (options?.prefix ?? '') });
			return {
				...result,
				keys: result.keys.map((key) => ({ ...key, name: key.name.slice(prefix.length) }))
			};
		}
	} as unknown as KVNamespace;
	const headers = new Headers(request.headers);
	headers.delete('X-Ak5-Mcp-Portal');
	const target = new Request(portal.sub + url.pathname + url.search, request);
	const response = await mcpProvider(portal.sub, portal.type).fetch(
		new Request(target, { headers }),
		{ ...env, OAUTH_KV: scoped },
		ctx
	);
	const output = new Headers(response.headers);
	output.set('Cache-Control', 'no-store');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: output
	});
}
