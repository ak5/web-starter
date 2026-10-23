export function displayNumber(value: number | null | undefined) {
	return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export function displayCompactNumber(value: number | null | undefined) {
	return new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 2
	}).format(value ?? 0);
}

export function displayDate(value: Date | string | null | undefined) {
	if (!value) return 'Not set';
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(new Date(value));
}

export function accountEmailSummary(emailVerified: boolean) {
	return emailVerified
		? {
				statusLabel: 'Verified email',
				statusBadgeClass: 'badge-success',
				actionHref: null,
				actionLabel: null
			}
		: {
				statusLabel: 'Email not verified',
				statusBadgeClass: 'badge-warning',
				actionHref: '/account/verify',
				actionLabel: 'Verify email'
			};
}
