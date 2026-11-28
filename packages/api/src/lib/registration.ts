import type { Env } from '../types';

export function isRegistrationOpen(env: Env) {
	return env.REGISTRATION_MODE === 'open';
}
