/**
 * Map api error codes to user-facing strings. Hono routes return stable
 * `snake_case` codes; web/admin turn those into copy at the UI boundary. Add a
 * row here when the API introduces a new error code worth a friendly message.
 */
const MESSAGES: Record<string, string> = {
	email_delivery_failed: 'Email could not be sent. Please try again later.',
	invitation_delivery_failed:
		'Account created, but the invitation could not be sent. The recipient can request a password reset to set their password.',
	invalid_credentials: 'Email or password is incorrect.',
	invalid_pin: 'That code is wrong or expired.',
	invalid_token: 'That link has expired. Please request a new one.',
	invalid_current_password: 'Current password is incorrect.',
	wrong_email: 'Please enter the email associated with your account.',
	username_taken: 'That username is already taken.',
	email_taken: 'An account with that email already exists.',
	rate_limited: 'Too many attempts — please try again in a few minutes.',
	recent_auth_required: 'Please log in again to confirm this action.',
	unauthorized: 'You need to sign in first.',
	forbidden: "You don't have permission to do that.",
	not_found: 'Could not find what you were looking for.',
	no_password: 'This account has no password set yet.',
	user_disabled: 'This account is disabled. Contact support.',
	user_not_found: 'User not found.',
	username_required: 'Username is required.',
	missing_code: 'Missing OAuth code.',
	no_profile: 'Could not load your profile from the provider.'
};

export function errorMessage(code: string | undefined | null, fallback?: string): string {
	if (!code) return fallback ?? 'Something went wrong.';
	if (code in MESSAGES) return MESSAGES[code];
	if (fallback) return fallback;
	return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
