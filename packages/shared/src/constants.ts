/**
 * Application-wide constants to eliminate magic values.
 */

// Pagination
export const DEFAULT_PAGE_SIZE = 20;

// Time intervals (milliseconds)
export const TIME_MS = {
	ONE_MINUTE: 60 * 1000,
	ONE_HOUR: 60 * 60 * 1000,
	ONE_DAY: 24 * 60 * 60 * 1000,
	ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
	TWO_WEEKS: 14 * 24 * 60 * 60 * 1000,
	THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000
} as const;

// Auth / session
export const SESSION_EXPIRY_MS = TIME_MS.ONE_WEEK;
export const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_PIN_ATTEMPTS = 5;
export const PASSWORD_MAX_LENGTH = 128;
export const LAST_LOGIN_UPDATE_MS = 15 * 60 * 1000; // 15 minutes

// Rate limiting (per IP per logical action)
export const RATE_LIMIT = {
	LOGIN: { maxAttempts: 10, windowSeconds: 300 },
	REGISTER: { maxAttempts: 5, windowSeconds: 300 },
	FORGOT_PASSWORD: { maxAttempts: 3, windowSeconds: 300 }
} as const;

// Response-time padding to blunt user-enumeration timing on auth endpoints (ms).
export const TIMING_DELAY_BASE_MS = 1500;
export const TIMING_DELAY_JITTER_MS = 500;

// File upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const IMAGE_UPLOAD_TARGETS = {
	AVATAR: {
		width: 512,
		height: 512,
		label: 'Profile picture'
	}
} as const;
