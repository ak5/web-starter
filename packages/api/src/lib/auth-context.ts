import type { Context } from 'hono';
import type { JwtPayload } from '@ak5/shared';
import type { AppContext } from '../types';

export function activeAuth(c: Context<AppContext>): JwtPayload {
	const auth = c.var.auth;
	if (!auth) throw new Error('Expected authenticated request context');
	return auth;
}

export function activeAuthSub(c: Context<AppContext>): string {
	return activeAuth(c).sub;
}
