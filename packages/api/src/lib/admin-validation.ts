import { z } from 'zod';

export const adminCreateUserSchema = z.object({
	username: z
		.string()
		.min(5)
		.max(20)
		.regex(/^[a-zA-Z0-9_]+$/),
	email: z
		.string()
		.email()
		.transform((value) => value.trim().toLowerCase()),
	password: z.string().min(8).max(128),
	role: z.enum(['user', 'admin']).default('user')
});

export const adminInviteSchema = z.object({
	username: z
		.string()
		.trim()
		.min(5)
		.max(20)
		.regex(/^[a-zA-Z0-9_]+$/),
	email: z
		.string()
		.trim()
		.email()
		.transform((value) => value.toLowerCase()),
	role: z.enum(['user', 'admin']).optional(),
	roleRaw: z.string().optional()
});

export const adminLogQuerySchema = z.object({
	limit: z.string().optional(),
	page: z.string().optional()
});

export const adminTokenEmailParamSchema = z.object({
	email: z
		.string()
		.email()
		.transform((value) => value.trim().toLowerCase())
});

export const auditLogQuerySchema = z.object({
	limit: z.string().optional(),
	page: z.string().optional(),
	action: z.string().optional(),
	entityType: z.string().optional(),
	entityId: z.string().optional()
});

export const auditLogActionOptions = [
	'user.invite',
	'admin_user.invite',
	'user.delete',
	'user.ban',
	'user.unban',
	'user.impersonate.start',
	'user.impersonate.stop'
] as const;
