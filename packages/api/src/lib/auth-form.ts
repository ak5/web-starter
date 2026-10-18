import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '@ak5/shared';

// Trim + lowercase BEFORE validating, so surrounding whitespace and casing are
// normalised away rather than rejected (emails are case-insensitive).
export const emailSchema = z.string().trim().toLowerCase().pipe(z.string().email());

export const passwordSchema = z.string().min(8).max(PASSWORD_MAX_LENGTH);

export const usernameSchema = z
	.string()
	.min(5)
	.max(20)
	.regex(/^[a-zA-Z0-9_]+$/);

export const registerSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	username: usernameSchema,
	legalAcceptance: z.literal(true).optional()
});

export const loginSchema = z.object({
	email: emailSchema,
	password: passwordSchema
});

export const forgotPasswordSchema = z.object({
	email: emailSchema
});

export const acceptInviteSchema = z.object({
	token: z.string().min(16),
	password: passwordSchema,
	passwordConfirm: z.string().optional()
});

export const verifyEmailSchema = z.object({
	pin: z.string().length(6)
});

export const setPasswordSchema = z.object({
	newPassword: passwordSchema
});

export const changePasswordSchema = z.object({
	currentPassword: passwordSchema,
	newPassword: passwordSchema
});

export const magicLoginSchema = z.object({
	token: z.string()
});
