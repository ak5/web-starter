/**
 * AES-256-GCM token encryption for OAuth refresh tokens stored in the DB.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

function bytesToBase64(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function toAB(bytes: Uint8Array): ArrayBuffer {
	const ab = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(ab).set(bytes);
	return ab;
}

async function key(hexKey: string): Promise<CryptoKey> {
	if (!/^[a-f0-9]{64}$/i.test(hexKey)) {
		throw new Error('TOKEN_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters');
	}
	return crypto.subtle.importKey('raw', toAB(hexToBytes(hexKey)), { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
}

export async function encryptToken(plain: string, hexKey: string): Promise<string> {
	const k = await key(hexKey);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, toAB(enc.encode(plain)))
	);
	const out = new Uint8Array(iv.length + ct.length);
	out.set(iv);
	out.set(ct, iv.length);
	return bytesToBase64(out);
}

export async function decryptToken(b64: string, hexKey: string): Promise<string> {
	const k = await key(hexKey);
	const all = base64ToBytes(b64);
	const iv = all.slice(0, 12);
	const ct = all.slice(12);
	const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, toAB(ct));
	return dec.decode(pt);
}
