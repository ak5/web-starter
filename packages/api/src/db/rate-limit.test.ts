import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db as makeDb } from './index';
import { createTestDatabase } from './testing';
import { rateLimits, users } from './schema';
import { rateLimit } from '../middleware/rate-limit';
import { withDb } from '../middleware/auth';
import { purgeExpiredRateLimits } from '../cron/jobs';
import { Logger } from '../lib/logger';
import { signJwt } from '../lib/jwt';
import { app } from '../app';
import type { AppContext, Env } from '../types';

test('D1 rate limits serialize attempts and expire without extending a blocked window', async (t) => {
	const local = await createTestDatabase();
	t.after(local.dispose);
	const db = makeDb(local.binding);
	const env = { DB: local.binding, JWT_SECRET: 'rate-test-secret' } as Env;
	const probe = new Hono<AppContext>()
		.use(withDb())
		.get('/', rateLimit({ key: 'probe', maxAttempts: 5, windowSeconds: 300 }), (c) => c.text('ok'));
	const responses = await Promise.all(
		Array.from({ length: 20 }, () => probe.request('/', {}, env))
	);
	assert.equal(responses.filter((r) => r.status === 200).length, 5);
	assert.equal(responses.filter((r) => r.status === 429).length, 15);
	const blocked = responses.find((r) => r.status === 429)!;
	const initialRetry = Number(blocked.headers.get('retry-after'));
	assert.ok(initialRetry > 0 && initialRetry <= 300);
	assert.deepEqual(await blocked.json(), { error: 'rate_limited', retryAfter: initialRetry });
	const before = await db.query.rateLimits.findFirst();
	assert.equal(before?.attempts, 5);
	assert.equal((await probe.request('/', {}, env)).status, 429);
	assert.deepEqual(await db.query.rateLimits.findFirst(), before);
	await db
		.update(rateLimits)
		.set({ expiresAt: new Date(Date.now() + 30_000) })
		.where(eq(rateLimits.key, 'probe:ip:unknown'));
	const nearExpiry = await probe.request('/', {}, env);
	assert.equal(nearExpiry.status, 429);
	const remainingRetry = Number(nearExpiry.headers.get('retry-after'));
	assert.ok(remainingRetry > 0 && remainingRetry <= 30);
	assert.deepEqual(await nearExpiry.json(), { error: 'rate_limited', retryAfter: remainingRetry });
	assert.equal(
		(await probe.request('/', { headers: { 'cf-connecting-ip': '192.0.2.1' } }, env)).status,
		200
	);
	await db
		.update(rateLimits)
		.set({ expiresAt: new Date(0) })
		.where(eq(rateLimits.key, 'probe:ip:unknown'));
	assert.equal((await probe.request('/', {}, env)).status, 200);
	assert.equal(
		(await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, 'probe:ip:unknown') }))
			?.attempts,
		1
	);
	await db.insert(rateLimits).values({ key: 'expired', attempts: 1, expiresAt: new Date(0) });
	await purgeExpiredRateLimits({
		db,
		logger: new Logger(undefined, undefined)
	});
	assert.equal(
		await db.query.rateLimits.findFirst({ where: eq(rateLimits.key, 'expired') }),
		undefined
	);
	assert.equal((await db.select().from(rateLimits)).length, 2);

	await db.insert(users).values([
		{ id: 'alice', publicId: 'u-alice', username: 'alice' },
		{ id: 'bob', publicId: 'u-bob', username: 'bob' }
	]);
	const token = (sub: string) =>
		signJwt(env.JWT_SECRET, {
			sub,
			email: `${sub}@example.test`,
			type: 'user',
			emailConfirmed: false,
			hasPassword: true,
			recentAuthAt: Math.floor(Date.now() / 1000)
		});
	const alice = await token('u-alice');
	for (const [route, cap] of [
		['verify-email', 10],
		['resend-verification', 3],
		['set-password', 5],
		['change-password', 10],
		['request-reauth', 3],
		['magic-login', 10]
	] as const) {
		// Seed a full bucket so mail/password handlers cannot run during this boundary test.
		await db.insert(rateLimits).values({
			key: `${route.replaceAll('-', '_')}:user:u-alice`,
			attempts: cap,
			expiresAt: new Date(Date.now() + 300_000)
		});
		const result = await app.request(
			`/auth/${route}`,
			{
				method: 'POST',
				headers: { cookie: `ak5_token=${alice}`, 'cf-connecting-ip': '192.0.2.99' }
			},
			env
		);
		assert.equal(result.status, 429, route);
	}
	const bob = await token('u-bob');
	assert.equal(
		(
			await app.request(
				'/auth/verify-email',
				{
					method: 'POST',
					headers: { cookie: `ak5_token=${bob}`, 'content-type': 'application/json' },
					body: JSON.stringify({ pin: '000000' })
				},
				env
			)
		).status,
		400
	);
});
