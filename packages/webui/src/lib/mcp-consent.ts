const escape = (value: string) =>
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

function consentPage(
	theme: string | undefined,
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
:root {
  color-scheme: ${theme === 'light' || theme === 'dark' ? theme : 'light dark'};
  /* Match the starter’s DaisyUI light and dark palettes without loading scripts. */
  --base: light-dark(oklch(100% 0 0), oklch(25.33% .016 252.42));
  --surface: light-dark(oklch(98% 0 0), oklch(23.26% .014 253.1));
  --ink: light-dark(oklch(21% .006 285.885), oklch(97.807% .029 256.847));
  --primary: light-dark(oklch(45% .24 277.023), oklch(58% .233 277.117));
  --on-primary: light-dark(oklch(93% .034 272.788), oklch(96% .018 272.314));
  --border: color-mix(in oklab, var(--ink) 22%, var(--base));
  font: 16px/1.5 system-ui, sans-serif;
  color: var(--ink);
  background: var(--base);
}
* { box-sizing: border-box; }
body { min-height: 100svh; margin: 0; display: grid; place-items: center; padding: clamp(16px, 5vw, 32px); }
main { width: min(100%, 30rem); padding: clamp(20px, 6vw, 32px); background: var(--surface); border: 1px solid var(--border); border-radius: .5rem; overflow-wrap: anywhere; }
.brand, .account, .actions { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
.brand { font-weight: 700; }
.brand img { width: 24px; height: 24px; }
h1 { font-size: clamp(1.5rem, 5vw, 1.875rem); line-height: 1.2; margin: 1.25rem 0 .5rem; }
p { margin: 0 0 1rem; }
.account { margin: 1rem 0; padding: .625rem .75rem; border: 1px solid var(--border); border-radius: .5rem; background: var(--base); }
.role { font-size: .875rem; }
fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
legend { font-weight: 650; margin-bottom: .5rem; }
.option { display: flex; align-items: flex-start; gap: .625rem; border: 1px solid var(--border); border-radius: .5rem; padding: .625rem .75rem; margin-bottom: .5rem; background: var(--base); cursor: pointer; }
.option:has(:checked) { border-color: var(--primary); background: color-mix(in oklab, var(--primary) 8%, var(--base)); }
input { accent-color: var(--primary); margin: .3rem 0 0; flex: none; }
small, .foot { font-size: .875rem; }
small { display: block; }
.actions { margin-top: 1rem; }
.primary, .secondary { display: inline-flex; align-items: center; min-height: 44px; padding: .5rem 1rem; border: 1px solid transparent; border-radius: .25rem; text-decoration: none; font: inherit; font-weight: 650; cursor: pointer; }
.primary { color: var(--on-primary); background: var(--primary); }
.primary:hover { background: color-mix(in oklab, var(--primary) 90%, black); }
.secondary { color: var(--ink); background: var(--base); border-color: var(--border); }
.secondary:hover { background: color-mix(in oklab, var(--ink) 8%, var(--base)); }
:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.foot { margin-top: 1rem; }
.foot p { margin: 0; }
</style></head><body><main><div class="brand"><img src="/favicon.svg" alt=""><span>ak5-web</span></div>
<h1>${escape(title)}</h1>${content}</main></body></html>`,
		{ headers, status }
	);
}

export async function renderMcpConsent(response: Response, theme?: string) {
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
			theme,
			'Connection expired',
			'<p>Start Connect again from Codex to approve a new request.</p>',
			headers,
			400
		);
	if (data.state === 'unavailable')
		return consentPage(
			theme,
			'Connection unavailable',
			'<p>ak5-web could not verify your session. Try again in a moment.</p>',
			headers,
			503
		);
	if (data.state === 'impersonating')
		return consentPage(
			theme,
			'End impersonation to connect',
			'<p>End the support session before connecting your own account.</p><a class="primary" href="/">Open ak5-web</a>',
			headers
		);
	const isAdmin = data.role === 'admin';
	const account = isAdmin ? 'Admin' : 'User';
	const client = escape(data.client ?? 'Codex');
	if (data.state === 'signed-out')
		return consentPage(
			theme,
			'Connect ak5-web',
			`
			<p>Sign in with your ak5-web ${account.toLowerCase()} account to continue connecting <strong>${client}</strong>.</p>
			<div class="actions"><a class="primary" href="${escape(data.login ?? '/login')}">Sign in as ${account.toLowerCase()}</a></div>`,
			headers
		);
	if (data.state !== 'ready' || !data.handle || !data.binding || !data.email || !data.redirectHost)
		return consentPage(
			theme,
			'Connection unavailable',
			'<p>Start Connect again from Codex.</p>',
			headers,
			503
		);
	return consentPage(
		theme,
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
