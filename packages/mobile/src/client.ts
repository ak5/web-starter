import { hc } from 'hono/client';
import type { WebApiType } from '@ak5/api';
import { COOKIE_TOKEN } from '@ak5/shared/cookie';

export interface SessionStorage {
	get(): Promise<string | null>;
	set(token: string): Promise<void>;
	clear(): Promise<void>;
}

export class InputError extends Error {}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

/** Native fetch exposes Set-Cookie; keep its JWT in the device's secure store. */
export function createClient(baseUrl: string, storage: SessionStorage, transport = fetch) {
	let token: string | null = null;
	const api = hc<WebApiType>(baseUrl, {
		fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
			const headers = new Headers(init?.headers);
			if (token) headers.set('Cookie', `${COOKIE_TOKEN}=${token}`);
			const response = await transport(input, { ...init, headers, credentials: 'omit' });
			const cookie = response.headers.get('set-cookie');
			const next = cookie?.match(new RegExp(`(?:^|[,;]\\s*)${COOKIE_TOKEN}=([^;]*)`));
			if (next) {
				token = next[1] || null;
				if (token) await storage.set(token);
				else await storage.clear();
			}
			if (response.status === 401) {
				token = null;
				await storage.clear();
			}
			return response;
		}
	});

	async function read<R extends { ok: boolean; status: number; json(): Promise<unknown> }>(
		response: R
	) {
		const body = await response.json();
		if (!response.ok) {
			const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
			throw new ApiError(response.status, typeof error === 'string' ? error : 'Request failed');
		}
		return body as Exclude<Awaited<ReturnType<R['json']>>, { error: string }>;
	}

	return {
		async restore() {
			token = await storage.get();
			if (!token) return null;
			return read(await api.auth.me.$get());
		},
		async login(email: string, password: string) {
			await read(await api.auth.login.$post({ json: { email, password } }));
			if (!token) throw new ApiError(502, 'The server did not return a session. Please retry.');
			return read(await api.auth.me.$get());
		},
		async register(email: string, password: string, username: string, legalAcceptance: boolean) {
			if (!legalAcceptance) throw new InputError('Accept the policies before creating an account.');
			const result = await read(
				await api.auth.register.$post({
					json: { email, password, username, legalAcceptance: true }
				})
			);
			if (!token) throw new ApiError(502, 'The server did not return a session. Please sign in.');
			return { result, user: await read(await api.auth.me.$get()) };
		},
		async logout() {
			try {
				await read(await api.auth.logout.$post());
			} catch {
				// Server logout only clears this stateless cookie; local removal is authoritative.
			}
			await storage.clear();
			token = null;
		},
		async verify(pin: string) {
			await read(await api.auth['verify-email'].$post({ json: { pin } }));
			return read(await api.auth.me.$get());
		},
		async resend() {
			return read(await api.auth['resend-verification'].$post());
		},
		async recover(email: string) {
			return read(await api.auth['forgot-password'].$post({ json: { email } }));
		},
		async list(page = 0) {
			return read(await api.items.$get({ query: { page: String(page) } }));
		},
		async create(data: Record<string, unknown>) {
			return read(await api.items.$post({ json: { data } }));
		},
		async update(id: string, data: Record<string, unknown>) {
			return read(await api.items[':id'].$patch({ param: { id }, json: { data } }));
		},
		async remove(id: string) {
			return read(await api.items[':id'].$delete({ param: { id } }));
		}
	};
}

export function parseItemData(text: string): Record<string, unknown> {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new InputError('Enter a valid JSON object.');
	}
	if (!data || typeof data !== 'object' || Array.isArray(data))
		throw new InputError('Enter a JSON object.');
	return data as Record<string, unknown>;
}
