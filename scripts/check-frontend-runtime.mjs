import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

async function check(origin) {
	const page = await fetch(new URL('/login', origin), {
		signal: AbortSignal.timeout(10_000)
	});
	assert.ok(page.ok, `Login returned ${page.status}`);
	assert.match(page.headers.get('content-security-policy') ?? '', /'nonce-/);
	const html = await page.text();
	const modulePath = html.match(/(?:src=|from |import )["'](\/assets\/[^"'\s]+\.js)["']/)?.[1];
	assert.ok(modulePath, 'Login has a built JavaScript module');
	const module = await fetch(new URL(modulePath, origin), { signal: AbortSignal.timeout(10_000) });
	assert.ok(module.ok, `JavaScript module returned ${module.status}`);
	assert.match(module.headers.get('content-type') ?? '', /javascript/);
	await module.body?.cancel();
}

for (const origin of process.argv.slice(2)) {
	for (let attempt = 1; ; attempt++) {
		try {
			await check(origin);
			console.log(`Frontend HTML and module OK at ${origin}`);
			break;
		} catch (error) {
			if (attempt === 4)
				throw new Error(`Frontend smoke check failed at ${origin}`, { cause: error });
			await setTimeout(2_000);
		}
	}
}
