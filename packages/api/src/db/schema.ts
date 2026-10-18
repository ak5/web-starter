/**
 * @ak5/api D1 schema (Drizzle sqlite-core).
 *
 * Platform identity + auth + audit tables. Replace/extend with your own domain
 * tables — keep the identity spine (`users`, `admin_users`, `auth_*`, `tokens`)
 * intact unless you've read `docs/architecture/auth.md`.
 *
 * Conventions:
 *   - `public_id` on every externally-exposed entity (never expose the PK).
 *   - `tokens` is exclusive-arc: exactly one of (user_id, admin_id) is set.
 *   - `auth_email` / `auth_discord` carry a `subject_type` + `subject_id`
 *     discriminator so admins and users share the auth tables.
 */
import { sql, isNull, relations } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

// ============================================================================
// Helpers
// ============================================================================

const nanoid21 = () => nanoid(21);
const id = () => text('id').primaryKey().$default(nanoid21);
const ts = (col: string) => integer(col, { mode: 'timestamp_ms' });

// ============================================================================
// Identity tables
// ============================================================================

export const users = sqliteTable(
	'users',
	{
		id: id(),
		publicId: text('public_id').notNull().unique(),
		username: text('username').notNull(),
		displayName: text('display_name'),
		avatar: text('avatar'),
		avatarSource: text('avatar_source', { enum: ['discord', 'upload'] }),
		email: text('email'),
		emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
		role: text('role', { enum: ['user', 'admin'] })
			.default('user')
			.notNull(),
		bannedAt: ts('banned_at'),
		termsAcceptedAt: ts('terms_accepted_at'),
		termsVersion: text('terms_version'),
		privacyVersion: text('privacy_version'),
		acceptableUseVersion: text('acceptable_use_version'),
		usernameChangeAt: ts('username_change_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull(),
		lastLoginAt: ts('last_login_at'),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull(),
		deletedAt: ts('deleted_at')
	},
	(t) => [
		check('users_role', sql`${t.role} IN ('user', 'admin')`),
		check(
			'users_avatar_source',
			sql`${t.avatarSource} IS NULL OR ${t.avatarSource} IN ('discord', 'upload')`
		),
		uniqueIndex('users_username_unique').on(t.username).where(isNull(t.deletedAt)),
		uniqueIndex('users_email_unique').on(t.email).where(isNull(t.deletedAt))
	]
);

export const adminUsers = sqliteTable(
	'admin_users',
	{
		id: id(),
		publicId: text('public_id').notNull().unique(),
		email: text('email').notNull(),
		username: text('username').notNull(),
		displayName: text('display_name'),
		emailVerified: integer('email_verified', { mode: 'boolean' }).default(true).notNull(),
		lastLoginAt: ts('last_login_at'),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull(),
		deletedAt: ts('deleted_at')
	},
	(t) => [
		uniqueIndex('admin_users_email_unique').on(t.email).where(isNull(t.deletedAt)),
		uniqueIndex('admin_users_username_unique').on(t.username).where(isNull(t.deletedAt))
	]
);

// ============================================================================
// Auth identities (single table per provider, discriminated by subject_type)
// ============================================================================

export const authEmail = sqliteTable(
	'auth_email',
	{
		id: id(),
		subjectType: text('subject_type', { enum: ['user', 'admin'] }).notNull(),
		subjectId: text('subject_id').notNull(),
		email: text('email').notNull(),
		passwordHashed: text('password_hashed').notNull(),
		verified: integer('verified', { mode: 'boolean' }).default(false).notNull(),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull()
	},
	(t) => [
		check('auth_email_subject_type', sql`${t.subjectType} IN ('user', 'admin')`),
		uniqueIndex('auth_email_email_unique').on(t.subjectType, t.email),
		index('auth_email_subject_idx').on(t.subjectType, t.subjectId)
	]
);

export const authDiscord = sqliteTable(
	'auth_discord',
	{
		id: id(),
		subjectType: text('subject_type', { enum: ['user', 'admin'] }).notNull(),
		subjectId: text('subject_id').notNull(),
		discordId: text('discord_id').notNull(),
		discordUsername: text('discord_username'),
		discordAvatar: text('discord_avatar'),
		discordEmail: text('discord_email'),
		discordData: text('discord_data', { mode: 'json' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		tokenExpiresAt: ts('token_expires_at'),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull()
	},
	(t) => [
		check('auth_discord_subject_type', sql`${t.subjectType} IN ('user', 'admin')`),
		uniqueIndex('auth_discord_id_unique').on(t.subjectType, t.discordId),
		index('auth_discord_subject_idx').on(t.subjectType, t.subjectId)
	]
);

export const apiKeys = sqliteTable(
	'api_keys',
	{
		id: id(),
		publicId: text('public_id').notNull().unique(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		label: text('label').notNull(),
		keyPrefix: text('key_prefix').notNull(),
		keyHash: text('key_hash').notNull(),
		scopes: text('scopes', { mode: 'json' }).$type<string[]>(),
		expiresAt: ts('expires_at'),
		lastUsedAt: ts('last_used_at'),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull()
	},
	(t) => [index('api_keys_user_idx').on(t.userId)]
);

// ============================================================================
// Sessions (JWT cookies are the active auth mechanism; web/admin hooks do not
// read this table — it exists for any server-side session bookkeeping you add).
// ============================================================================

export const sessions = sqliteTable('sessions', {
	id: id(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	extraPrivileges: text('extra_privileges', { mode: 'json' }),
	lastLoginAt: ts('last_login_at'),
	createdAt: ts('created_at')
		.default(sql`(unixepoch() * 1000)`)
		.notNull()
});

// ============================================================================
// Tokens (exclusive-arc: exactly one of user_id / admin_id is set)
// ============================================================================

export const tokens = sqliteTable(
	'tokens',
	{
		id: id(),
		userId: text('user_id').references(() => users.id),
		adminId: text('admin_id').references(() => adminUsers.id),
		purpose: text('purpose', {
			enum: ['verify_email', 'reset_password', 'magic_login', 'email_change']
		}).notNull(),
		tokenHash: text('token_hash').notNull(),
		expiresAt: ts('expires_at').notNull(),
		attempts: integer('attempts').default(0).notNull(),
		payload: text('payload', { mode: 'json' }),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull()
	},
	(t) => [
		check(
			'tokens_purpose',
			sql`${t.purpose} IN ('verify_email', 'reset_password', 'magic_login', 'email_change')`
		),
		check('tokens_exclusive_arc', sql`(${t.userId} IS NOT NULL) + (${t.adminId} IS NOT NULL) = 1`),
		index('tokens_hash_idx').on(t.tokenHash),
		index('tokens_user_purpose_idx').on(t.userId, t.purpose),
		index('tokens_admin_purpose_idx').on(t.adminId, t.purpose)
	]
);

// ============================================================================
// Operational tables
// ============================================================================

export const logs = sqliteTable(
	'logs',
	{
		id: id(),
		timestamp: ts('timestamp').notNull(),
		level: text('level', { enum: ['debug', 'info', 'warn', 'error'] }).notNull(),
		context: text('context', { mode: 'json' }).notNull(),
		data: text('data', { mode: 'json' }).notNull()
	},
	(t) => [check('logs_level', sql`${t.level} IN ('debug', 'info', 'warn', 'error')`)]
);

export const config = sqliteTable('config', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

// ============================================================================
// Audit log (admin actions — accountability-relevant events).
// ============================================================================

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: id(),
		adminId: text('admin_id').references(() => adminUsers.id),
		action: text('action').notNull(),
		entityType: text('entity_type'),
		entityId: text('entity_id'),
		payload: text('payload', { mode: 'json' }),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull()
	},
	(t) => [
		index('audit_log_admin_idx').on(t.adminId),
		index('audit_log_action_idx').on(t.action),
		index('audit_log_entity_idx').on(t.entityType, t.entityId),
		index('audit_log_created_idx').on(t.createdAt)
	]
);

// ============================================================================
// Example domain table — a generic per-user `item` with a free-form `data`
// JSON payload. This is the demo CRUD resource the native mobile app (packages/mobile)
// drives end-to-end. Replace it with your real domain tables; it is safe to
// delete wholesale (this table, its relation + inferred type, the `item`
// public-id prefix, `lib/items.ts`, `routes/items.ts`, and the `/items` mount
// in `app.ts`) — nothing in the identity spine depends on it.
// ============================================================================

export const items = sqliteTable(
	'items',
	{
		id: id(),
		publicId: text('public_id').notNull().unique(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id),
		data: text('data', { mode: 'json' }).notNull().default({}),
		createdAt: ts('created_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull(),
		modifiedAt: ts('modified_at')
			.default(sql`(unixepoch() * 1000)`)
			.notNull()
	},
	(t) => [index('items_user_idx').on(t.userId, t.createdAt)]
);

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
	sessions: many(sessions),
	apiKeys: many(apiKeys),
	tokens: many(tokens, { relationName: 'user_tokens' }),
	authEmail: one(authEmail),
	authDiscord: one(authDiscord),
	items: many(items)
}));

export const itemsRelations = relations(items, ({ one }) => ({
	user: one(users, { fields: [items.userId], references: [users.id] })
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
	tokens: many(tokens, { relationName: 'admin_tokens' }),
	auditLog: many(auditLog)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] })
}));

export const tokensRelations = relations(tokens, ({ one }) => ({
	user: one(users, {
		fields: [tokens.userId],
		references: [users.id],
		relationName: 'user_tokens'
	}),
	admin: one(adminUsers, {
		fields: [tokens.adminId],
		references: [adminUsers.id],
		relationName: 'admin_tokens'
	})
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
	user: one(users, { fields: [apiKeys.userId], references: [users.id] })
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
	admin: one(adminUsers, { fields: [auditLog.adminId], references: [adminUsers.id] })
}));

// ============================================================================
// Inferred row types
// ============================================================================

export type User = typeof users.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type TokenRow = typeof tokens.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type AuthEmail = typeof authEmail.$inferSelect;
export type AuthDiscord = typeof authDiscord.$inferSelect;
export type Item = typeof items.$inferSelect;
