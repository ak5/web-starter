import type { EmailConfig } from '@ak5/email';
import type { Env } from '../types';

export function emailConfig(env: Env): EmailConfig {
	return {
		email: env.EMAIL,
		fromAddress: env.PUBLIC_EMAIL_FROM,
		fromName: 'ak5-web',
		mockApiUrl: env.EMAIL_MOCK_URL
	};
}
