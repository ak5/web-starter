/**
 * Auth routes — split into pre-login (URL carries the role since there is no
 * JWT yet) and post-login (single set, JWT carries the role).
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppContext } from '../../types';
import { rateLimit } from '../../middleware/rate-limit';
import { requireAuth, requireRecentAuth } from '../../middleware/auth';
import { activeAuth } from '../../lib/auth-context';
import {
	acceptInviteSchema,
	changePasswordSchema,
	forgotPasswordSchema,
	loginSchema,
	magicLoginSchema,
	registerSchema,
	setPasswordSchema,
	verifyEmailSchema
} from '../../lib/auth-form';
import {
	acceptInvitePreAuth,
	forgotUserPasswordPreAuth,
	forgotAdminPasswordPreAuth,
	loginAdminPreAuth,
	loginUserPreAuth,
	preLoginAuthOptions,
	registerUserPreAuth
} from '../../lib/auth-prelogin';
import {
	authSubjectSummary,
	changePasswordPostAuth,
	logoutPostAuth,
	magicLoginPostAuthWithInput,
	requestReauthPostAuth,
	resendVerificationPostAuth,
	setPasswordPostAuthWithInput,
	stopImpersonationPostAuth,
	verifyEmailPostAuthWithInput
} from '../../lib/auth-postlogin';
import { apiBodyJson } from '../../lib/api-response';
import { authJson, authJsonWithCookies } from '../../lib/auth-response';

// ============================================================================
// Pre-login routes (USER)
// ============================================================================

export const userPreAuth = new Hono<AppContext>()
	.get('/options', (c) => c.json(preLoginAuthOptions()))
	.post(
		'/register',
		rateLimit({ key: 'register', maxAttempts: 5, windowSeconds: 300 }),
		zValidator('json', registerSchema),
		async (c) => {
			const result = await registerUserPreAuth(c.var.db, c.env, c.req.valid('json'));
			return authJson(c, result);
		}
	)
	.post(
		'/login',
		rateLimit({ key: 'login', maxAttempts: 10, windowSeconds: 300 }),
		zValidator('json', loginSchema),
		async (c) => {
			const result = await loginUserPreAuth(c.var.db, c.env, c.req.valid('json'));
			return authJson(c, result);
		}
	)
	.post(
		'/forgot-password',
		rateLimit({ key: 'forgot_password', maxAttempts: 3, windowSeconds: 300 }),
		zValidator('json', forgotPasswordSchema),
		async (c) => {
			return c.json(
				await forgotUserPasswordPreAuth(c.var.db, c.env, c.req.valid('json'), (promise) =>
					c.executionCtx.waitUntil(promise)
				)
			);
		}
	);

// ============================================================================
// Pre-login routes (ADMIN)
// ============================================================================

export const adminPreAuth = new Hono<AppContext>()
	.post(
		'/admin/login',
		rateLimit({ key: 'admin_login', maxAttempts: 10, windowSeconds: 300 }),
		zValidator('json', loginSchema),
		async (c) => {
			const result = await loginAdminPreAuth(c.var.db, c.env, c.req.valid('json'));
			return authJson(c, result);
		}
	)
	.post(
		'/admin/forgot-password',
		rateLimit({ key: 'admin_forgot_password', maxAttempts: 3, windowSeconds: 300 }),
		zValidator('json', forgotPasswordSchema),
		async (c) => {
			return c.json(
				await forgotAdminPasswordPreAuth(c.var.db, c.env, c.req.valid('json'), (promise) =>
					c.executionCtx.waitUntil(promise)
				)
			);
		}
	);

// ============================================================================
// Public invite acceptance (mounted for both web/admin scoped clients)
// ============================================================================

export const inviteAuth = new Hono<AppContext>().post(
	'/accept-invite',
	zValidator('json', acceptInviteSchema),
	async (c) => {
		const result = await acceptInvitePreAuth(c.var.db, c.env, c.req.valid('json'));
		return authJson(c, result);
	}
);

// ============================================================================
// Post-login routes (unified — JWT carries `type`)
// ============================================================================

export const postAuth = new Hono<AppContext>()
	.use(requireAuth())
	.get('/me', async (c) => {
		return c.json(authSubjectSummary(activeAuth(c)));
	})
	.post('/logout', async (c) => {
		const result = logoutPostAuth(c.env);
		return authJsonWithCookies(c, result);
	})
	.post('/stop-impersonate', async (c) => {
		const result = await stopImpersonationPostAuth(
			c.var.db,
			c.env,
			activeAuth(c),
			c.req.header('cookie') ?? ''
		);
		return authJsonWithCookies(c, result);
	})
	.post('/verify-email', zValidator('json', verifyEmailSchema), async (c) => {
		const result = await verifyEmailPostAuthWithInput(
			c.var.db,
			c.env,
			activeAuth(c),
			c.req.valid('json')
		);
		return authJson(c, result);
	})
	.post('/resend-verification', async (c) => {
		const result = await resendVerificationPostAuth(c.var.db, c.env, activeAuth(c));
		return apiBodyJson(c, result);
	})
	.post('/set-password', zValidator('json', setPasswordSchema), async (c) => {
		const result = await setPasswordPostAuthWithInput(
			c.var.db,
			c.env,
			activeAuth(c),
			c.req.valid('json')
		);
		return authJson(c, result);
	})
	.post(
		'/change-password',
		requireRecentAuth(),
		zValidator('json', changePasswordSchema),
		async (c) => {
			const result = await changePasswordPostAuth(c.var.db, activeAuth(c), c.req.valid('json'));
			return apiBodyJson(c, result);
		}
	)
	.post('/request-reauth', async (c) => {
		const result = await requestReauthPostAuth(c.var.db, c.env, activeAuth(c));
		return apiBodyJson(c, result);
	})
	.post('/magic-login', zValidator('json', magicLoginSchema), async (c) => {
		const result = await magicLoginPostAuthWithInput(
			c.var.db,
			c.env,
			activeAuth(c),
			c.req.valid('json')
		);
		return authJson(c, result);
	});
