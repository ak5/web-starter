import { render } from '@react-email/render';
import * as React from 'react';
import VerifyEmail, { type VerifyEmailProps } from './templates/verify-email.js';
import ResetPassword, { type ResetPasswordProps } from './templates/reset-password.js';
import LoginWith, { type LoginWithProps } from './templates/login-with.js';
import InviteAccount, { type InviteAccountProps } from './templates/invite-account.js';

export interface EmailSendBinding {
	send(message: {
		from: { email: string; name: string };
		to: string;
		subject: string;
		html: string;
	}): Promise<{ messageId: string }>;
}

export class EmailDeliveryError extends Error {
	constructor(public readonly code: string) {
		super('Email delivery failed. Please try again later.');
		this.name = 'EmailDeliveryError';
	}
}

export interface EmailConfig {
	email?: EmailSendBinding;
	fromAddress: string;
	fromName?: string;
	/** Local dev/test mock URL. If configured, a `/send` path is appended. */
	mockApiUrl?: string;
}

export interface EmailLogger {
	log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void;
}

export type TemplateName = 'VerifyEmail' | 'ResetPassword' | 'LoginWith' | 'InviteAccount';

export interface TemplateProps {
	VerifyEmail: VerifyEmailProps;
	ResetPassword: ResetPasswordProps;
	LoginWith: LoginWithProps;
	InviteAccount: InviteAccountProps;
}

const TEMPLATE_REGISTRY: {
	[K in TemplateName]: {
		component: React.ComponentType<TemplateProps[K]>;
		subject: string;
	};
} = {
	VerifyEmail: { component: VerifyEmail, subject: 'Verify Email' },
	ResetPassword: { component: ResetPassword, subject: 'Reset Password' },
	LoginWith: { component: LoginWith, subject: 'Account Access Attempt' },
	InviteAccount: { component: InviteAccount, subject: 'You are invited' }
};

export type { VerifyEmailProps, ResetPasswordProps, LoginWithProps, InviteAccountProps };

/**
 * Render a template to HTML. Platform-agnostic.
 */
export async function renderTemplate<T extends TemplateName>(
	template: T,
	props: TemplateProps[T]
): Promise<{ html: string; subject: string }> {
	const { component: Component, subject } = TEMPLATE_REGISTRY[template];
	const html = await render(React.createElement(Component, props));
	return { html, subject };
}

/** Resolve the local mock `/send` endpoint from a configured base URL. */
export function getMockSendUrl(baseUrl: string | undefined): string | null {
	if (!baseUrl) return null;

	try {
		const url = new URL(baseUrl);
		if (url.protocol !== 'https:' && !isLocalHttpUrl(url)) return null;

		url.pathname = `${url.pathname.replace(/\/+$/, '')}/send`;
		url.search = '';
		url.hash = '';
		return url.toString();
	} catch {
		return null;
	}
}

function isLocalHttpUrl(url: URL) {
	if (url.protocol !== 'http:') return false;
	return (
		url.hostname === 'localhost' ||
		url.hostname.endsWith('.localhost') ||
		url.hostname === '127.0.0.1' ||
		url.hostname === '[::1]'
	);
}

/** Send through the native Worker binding, or capture locally when a mock is configured. */
export async function sendEmail(
	config: EmailConfig,
	recipient: string,
	subject: string,
	html: string,
	logger?: EmailLogger
): Promise<boolean> {
	const transport = config.mockApiUrl ? 'mock' : 'cloudflare';
	try {
		if (config.mockApiUrl) {
			const sendUrl = getMockSendUrl(config.mockApiUrl);
			if (!sendUrl) throw new EmailDeliveryError('INVALID_MOCK_URL');
			const response = await fetch(sendUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					from: config.fromAddress,
					from_name: config.fromName ?? 'ak5-web',
					to: recipient,
					subject,
					html
				}),
				signal: AbortSignal.timeout(15_000)
			});
			if (!response.ok) throw new EmailDeliveryError(`HTTP_${response.status}`);
			const data = (await response.json()) as { success?: unknown } | null;
			if (data?.success !== true) throw new EmailDeliveryError('MOCK_NOT_CAPTURED');
		} else {
			if (!config.email) throw new EmailDeliveryError('MISSING_EMAIL_BINDING');
			const result = await config.email.send({
				from: { email: config.fromAddress, name: config.fromName ?? 'ak5-web' },
				to: recipient,
				subject,
				html
			});
			if (typeof result?.messageId !== 'string' || !result.messageId.trim()) {
				throw new EmailDeliveryError('MISSING_MESSAGE_ID');
			}
		}
		return true;
	} catch (error) {
		const rawCode = error && typeof error === 'object' && 'code' in error ? error.code : null;
		const code =
			typeof rawCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(rawCode) ? rawCode : 'SEND_FAILED';
		const event = { event: 'email.delivery_failed', transport, code };
		if (logger) logger.log('error', event.event, event);
		else console.error(JSON.stringify(event));
		throw new EmailDeliveryError(code);
	}
}

/**
 * Render a template and send it in one call. Convenience wrapper for the common case.
 */
export async function sendTemplate<T extends TemplateName>(
	config: EmailConfig,
	template: T,
	recipient: string,
	props: TemplateProps[T],
	logger?: EmailLogger
): Promise<boolean> {
	const { html, subject } = await renderTemplate(template, props);
	return sendEmail(config, recipient, subject, html, logger);
}
