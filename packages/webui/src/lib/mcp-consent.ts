export const escape = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			})[c]!
	);

export function consentPage(
	title: string,
	content: string,
	headers = new Headers(),
	status = 200,
	callbackOrigin?: string
) {
	headers.set('Content-Type', 'text/html; charset=utf-8');
	headers.set('Cache-Control', 'no-store');
	// Sending the referer only to our own portal keeps the same-origin form Origin header.
	headers.set('Referrer-Policy', 'same-origin');
	const callback =
		callbackOrigin &&
		/^https?:\/\/(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::[0-9]+)?$/i.test(callbackOrigin)
			? ' ' + callbackOrigin
			: '';
	headers.set(
		'Content-Security-Policy',
		`default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; form-action 'self'${callback}`
	);
	return new Response(
		`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} · ak5-web</title><link rel="icon" href="/favicon.svg">
<style>
:root{color-scheme:dark;font:16px/1.5 system-ui,sans-serif;color:#e9eef6;background:#0f131a}
*{box-sizing:border-box}body{min-height:100svh;margin:0;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#1b2b42,#0f131a 65%)}
main{width:min(100%,34rem);padding:clamp(20px,6vw,36px);background:#171d27;border:1px solid #344154;border-radius:18px;box-shadow:0 18px 52px #0004}
.brand,.account,.actions{display:flex;align-items:center;gap:12px}.brand img{width:34px;height:34px}.brand{font-weight:700}
h1{font-size:clamp(1.6rem,6vw,2rem);line-height:1.15;margin:24px 0 8px;letter-spacing:-.025em}p{margin:0 0 16px;color:#bdc8d8;overflow-wrap:anywhere}strong{color:#f0f5fc}
.account{margin:18px 0;padding:10px 12px;border-radius:8px;background:#202b3a;flex-wrap:wrap;overflow-wrap:anywhere}.role{color:#b8d8ff;font-size:.85rem;font-weight:700}
fieldset{margin:0;padding:0;border:0}legend{font-weight:650;margin-bottom:8px}.option{display:flex;gap:10px;align-items:flex-start;border:1px solid #3a4960;border-radius:9px;padding:11px 13px;margin-bottom:8px;cursor:pointer}
.option:has(:checked){border-color:#80baff;background:#20314a}input{accent-color:#90c6ff;margin:5px 0 0}small{display:block;color:#bdc8d8;font-size:.875rem}
.actions{flex-wrap:wrap;margin-top:20px}.primary,.secondary{display:inline-flex;align-items:center;min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid transparent;text-decoration:none;font:inherit;font-weight:650;cursor:pointer}
.primary{color:#101a28;background:#8ec4ff}.secondary{color:#c0ddff;background:transparent;border-color:#43546d}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #a6d2ff;outline-offset:3px}
.foot{margin-top:20px}.foot p{margin:12px 0 0;font-size:.875rem}
</style></head><body><main><div class="brand"><img src="/favicon.svg" alt=""><span>ak5-web</span></div>
<h1>${escape(title)}</h1>${content}</main></body></html>`,
		{ headers, status }
	);
}

export async function renderMcpConsent(response: Response) {
	const data = (await response.json()) as {
		state: string;
		role?: 'user' | 'admin';
		client?: string;
		email?: string;
		handle?: string;
		binding?: string;
		login?: string;
		redirectHost?: string;
		loopback?: boolean;
		callbackOrigin?: string;
	};
	const headers = new Headers(response.headers);
	if (data.state === 'expired')
		return consentPage(
			'Connection expired',
			'<p>Start Connect again from Codex to approve a new request.</p>',
			headers,
			400
		);
	if (data.state === 'unavailable')
		return consentPage(
			'Connection unavailable',
			'<p>ak5-web could not verify your session. Try again in a moment.</p>',
			headers,
			503
		);
	if (data.state === 'impersonating')
		return consentPage(
			'End impersonation to connect',
			'<p>End the support session before connecting your own account.</p><a class="primary" href="/">Open ak5-web</a>',
			headers
		);
	const isAdmin = data.role === 'admin';
	const account = isAdmin ? 'Admin' : 'User';
	const client = escape(data.client ?? 'Codex');
	if (data.state === 'signed-out')
		return consentPage(
			'Connect ak5-web',
			`
			<p>Sign in with your ak5-web ${account.toLowerCase()} account to continue connecting <strong>${client}</strong>.</p>
			<div class="actions"><a class="primary" href="${escape(data.login ?? '/login')}">Sign in as ${account.toLowerCase()}</a></div>`,
			headers
		);
	if (data.state !== 'ready' || !data.handle || !data.binding || !data.email || !data.redirectHost)
		return consentPage(
			'Connection unavailable',
			'<p>Start Connect again from Codex.</p>',
			headers,
			503
		);
	return consentPage(
		'Connect ak5-web',
		`
		<p>Choose what <strong>${client}</strong> can do in ak5-web.</p>
		<div class="account"><span class="role">${account}</span><strong>${escape(data.email)}</strong></div>
		<form method="post"><input type="hidden" name="handle" value="${escape(data.handle)}"><input type="hidden" name="binding" value="${escape(data.binding)}">
			<fieldset><legend>Permissions</legend>
				<label class="option"><input type="radio" name="access" value="read" checked><span><strong>Read only</strong><small>${isAdmin ? 'View system health.' : 'View your items.'}</small></span></label>
				<label class="option"><input type="radio" name="access" value="write"><span><strong>Read and operate</strong><small>${isAdmin ? 'Also update your own display name.' : 'Also create items.'}</small></span></label>
			</fieldset>
			<div class="actions"><button class="primary" name="decision" value="allow">Connect</button><button class="secondary" name="decision" value="deny">Cancel</button></div>
		</form>
		<div class="foot"><p>After connecting, your browser returns to ${data.loopback ? 'the local app at ' : ''}<strong>${escape(data.redirectHost)}</strong>.</p></div>`,
		headers,
		200,
		data.callbackOrigin
	);
}
