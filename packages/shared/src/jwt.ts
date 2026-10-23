/**
 * JWT shape + sign / verify helpers shared across all workers.
 *
 * Uses HS256 via Web Crypto so the same code runs in Cloudflare Workers,
 * Node >=20, and the browser. The API signs and verifies JWTs; web + admin
 * share the same JWT_SECRET only to verify cookies and gate their own pages.
 */

export type JwtType = 'user' | 'admin';

export const JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
export const JWT_REFRESH_THRESHOLD = 0.5;
export const RECENT_AUTH_WINDOW_MINUTES = 15;

export interface JwtPayload {
	/** Public ID of the subject (e.g. `u-xxx`, `a-xxx`). Never a numeric PK. */
	sub: string;
	email: string;
	name?: string;
	type: JwtType;
	emailConfirmed: boolean;
	hasPassword: boolean;
	/** Unix timestamp (seconds) of the most recent password/magic-link auth. */
	recentAuthAt: number;
	/** Public ID of the admin currently impersonating this subject, if any. */
	impersonatedBy?: string;
	iat: number;
	exp: number;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
function base64urlEncode(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
	let normalized = s.replace(/-/g, '+').replace(/_/g, '/');
	while (normalized.length % 4) normalized += '=';
	const bin = atob(normalized);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function toAB(bytes: Uint8Array): ArrayBuffer {
	const ab = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(ab).set(bytes);
	return ab;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		toAB(enc.encode(secret)),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
}

export interface IssueJwtInput {
	sub: string;
	email: string;
	name?: string;
	type: JwtType;
	emailConfirmed: boolean;
	hasPassword: boolean;
	recentAuthAt: number;
	impersonatedBy?: string;
}

export async function signJwt(
	secret: string,
	claims: IssueJwtInput,
	expiresInSeconds = JWT_EXPIRY_SECONDS
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const payload: JwtPayload = { ...claims, iat: now, exp: now + expiresInSeconds };
	const headerB64 = base64urlEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
	const data = `${headerB64}.${payloadB64}`;
	const key = await hmacKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, toAB(enc.encode(data)));
	return `${data}.${base64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(secret: string, raw: string): Promise<JwtPayload | null> {
	const parts = raw.split('.');
	if (parts.length !== 3) return null;
	const [headerB64, payloadB64, sigB64] = parts;
	const data = `${headerB64}.${payloadB64}`;
	const key = await hmacKey(secret);
	const ok = await crypto.subtle.verify(
		'HMAC',
		key,
		toAB(base64urlDecode(sigB64)),
		toAB(enc.encode(data))
	);
	if (!ok) return null;
	let payload: JwtPayload;
	try {
		payload = JSON.parse(dec.decode(base64urlDecode(payloadB64))) as JwtPayload;
	} catch {
		return null;
	}
	if (payload.exp < Math.floor(Date.now() / 1000)) return null;
	return payload;
}

/** True if the JWT's strong-auth timestamp is inside the sensitive-action window. */
export function isRecentAuth(payload: JwtPayload): boolean {
	const now = Math.floor(Date.now() / 1000);
	return now - payload.recentAuthAt < RECENT_AUTH_WINDOW_MINUTES * 60;
}

/** True once a non-impersonation token is past the refresh threshold. */
export function shouldRefreshJwt(payload: JwtPayload): boolean {
	if (payload.impersonatedBy) return false;
	const now = Math.floor(Date.now() / 1000);
	const totalLifetime = payload.exp - payload.iat;
	const elapsed = now - payload.iat;
	return elapsed > totalLifetime * JWT_REFRESH_THRESHOLD;
}

/** Reissue an equivalent JWT with a fresh iat/exp. */
export async function refreshJwt(payload: JwtPayload, secret: string): Promise<string> {
	const claims = { ...payload };
	delete (claims as Partial<JwtPayload>).iat;
	delete (claims as Partial<JwtPayload>).exp;
	return signJwt(secret, claims);
}

/** Format a Set-Cookie header for the JWT, scoped to the configured cookie origin. */
export function jwtCookie(opts: {
	name: string;
	value: string;
	cookieOrigin: string;
	maxAgeSeconds?: number;
}): string {
	const max = opts.maxAgeSeconds ?? JWT_EXPIRY_SECONDS;
	const isSecure =
		!opts.cookieOrigin.includes('localhost') &&
		!/^\d+\.\d+\.\d+\.\d+$/.test(opts.cookieOrigin.replace(/^\./, ''));
	const parts = [
		`${opts.name}=${opts.value}`,
		'Path=/',
		`Max-Age=${max}`,
		'HttpOnly',
		'SameSite=Lax'
	];
	if (opts.cookieOrigin && opts.cookieOrigin !== 'localhost') {
		parts.push(`Domain=${opts.cookieOrigin}`);
	}
	if (isSecure) parts.push('Secure');
	return parts.join('; ');
}

/** Format a Set-Cookie header that clears the JWT. */
export function clearJwtCookie(name: string, cookieOrigin: string): string {
	const parts = [`${name}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
	if (cookieOrigin && cookieOrigin !== 'localhost') {
		parts.push(`Domain=${cookieOrigin}`);
	}
	return parts.join('; ');
}
