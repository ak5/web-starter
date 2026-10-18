export {
	EmailDeliveryError,
	type EmailSendBinding,
	getMockSendUrl,
	renderTemplate,
	sendEmail,
	sendTemplate,
	type EmailConfig,
	type EmailLogger,
	type TemplateName,
	type TemplateProps,
	type VerifyEmailProps,
	type ResetPasswordProps,
	type LoginWithProps,
	type InviteAccountProps
} from './send.js';

export { default as VerifyEmail } from './templates/verify-email.js';
export { default as ResetPassword } from './templates/reset-password.js';
export { default as LoginWith } from './templates/login-with.js';
export { default as InviteAccount } from './templates/invite-account.js';
