/**
 * @ak5/api Postgres schema (Drizzle pg-core).
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
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	pgEnum,
	timestamp,
	uniqueIndex,
	varchar
} from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

// ============================================================================
// Enums
// ============================================================================

export const userRole = pgEnum('user_role', ['user', 'admin']);
export const tokenPurpose = pgEnum('token_purpose', [
	'verify_email',
	'reset_password',
	'magic_login',
	'email_change'
]);
export const subjectType = pgEnum('subject_type', ['user', 'admin']);
export const logLevel = pgEnum('log_level', ['debug', 'info', 'warn', 'error']);
export const avatarSource = pgEnum('avatar_source', ['discord', 'upload']);

// ============================================================================
// Helpers
// ============================================================================

const nanoid21 = () => nanoid(21);
const id = () => varchar('id', { length: 21 }).primaryKey().$default(nanoid21);
const ts = (col: string) => timestamp(col, { withTimezone: true, mode: 'date' });

// ============================================================================
// Identity tables
// ============================================================================

export const users = pgTable(
	'users',
	{
		id: id(),
		publicId: varchar('public_id', { length: 24 }).notNull().unique(),
		username: varchar('username', { length: 64 }).notNull(),
		displayName: varchar('display_name', { length: 128 }),
		avatar: varchar('avatar', { length: 512 }),
		avatarSource: avatarSource('avatar_source'),
		email: varchar('email', { length: 320 }),
		emailVerified: boolean('email_verified').default(false).notNull(),
		role: userRole('role').default('user').notNull(),
		bannedAt: ts('banned_at'),
		termsAcceptedAt: ts('terms_accepted_at'),
		termsVersion: varchar('terms_version', { length: 32 }),
		privacyVersion: varchar('privacy_version', { length: 32 }),
		acceptableUseVersion: varchar('acceptable_use_version', { length: 32 }),
		usernameChangeAt: ts('username_change_at').defaultNow().notNull(),
		lastLoginAt: ts('last_login_at'),
		createdAt: ts('created_at').defaultNow().notNull(),
		deletedAt: ts('deleted_at')
	},
	(t) => [
		uniqueIndex('users_username_unique').on(t.username).where(isNull(t.deletedAt)),
		uniqueIndex('users_email_unique').on(t.email).where(isNull(t.deletedAt))
	]
);

export const adminUsers = pgTable(
	'admin_users',
	{
		id: id(),
		publicId: varchar('public_id', { length: 24 }).notNull().unique(),
		email: varchar('email', { length: 320 }).notNull(),
		username: varchar('username', { length: 64 }).notNull(),
		displayName: varchar('display_name', { length: 128 }),
		emailVerified: boolean('email_verified').default(true).notNull(),
		lastLoginAt: ts('last_login_at'),
		createdAt: ts('created_at').defaultNow().notNull(),
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

export const authEmail = pgTable(
	'auth_email',
	{
		id: id(),
		subjectType: subjectType('subject_type').notNull(),
		subjectId: varchar('subject_id', { length: 21 }).notNull(),
		email: varchar('email', { length: 320 }).notNull(),
		passwordHashed: varchar('password_hashed', { length: 256 }).notNull(),
		verified: boolean('verified').default(false).notNull(),
		createdAt: ts('created_at').defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('auth_email_email_unique').on(t.subjectType, t.email),
		index('auth_email_subject_idx').on(t.subjectType, t.subjectId)
	]
);

export const authDiscord = pgTable(
	'auth_discord',
	{
		id: id(),
		subjectType: subjectType('subject_type').notNull(),
		subjectId: varchar('subject_id', { length: 21 }).notNull(),
		discordId: varchar('discord_id', { length: 64 }).notNull(),
		discordUsername: varchar('discord_username', { length: 128 }),
		discordAvatar: varchar('discord_avatar', { length: 512 }),
		discordEmail: varchar('discord_email', { length: 320 }),
		discordData: jsonb('discord_data'),
		accessToken: varchar('access_token', { length: 1024 }),
		refreshToken: varchar('refresh_token', { length: 1024 }),
		tokenExpiresAt: ts('token_expires_at'),
		createdAt: ts('created_at').defaultNow().notNull()
	},
	(t) => [
		uniqueIndex('auth_discord_id_unique').on(t.subjectType, t.discordId),
		index('auth_discord_subject_idx').on(t.subjectType, t.subjectId)
	]
);

export const apiKeys = pgTable(
	'api_keys',
	{
		id: id(),
		publicId: varchar('public_id', { length: 24 }).notNull().unique(),
		userId: varchar('user_id', { length: 21 })
			.notNull()
			.references(() => users.id),
		label: varchar('label', { length: 64 }).notNull(),
		keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
		keyHash: varchar('key_hash', { length: 256 }).notNull(),
		scopes: jsonb('scopes').$type<string[]>(),
		expiresAt: ts('expires_at'),
		lastUsedAt: ts('last_used_at'),
		createdAt: ts('created_at').defaultNow().notNull()
	},
	(t) => [index('api_keys_user_idx').on(t.userId)]
);

// ============================================================================
// Sessions (JWT cookies are the active auth mechanism; web/admin hooks do not
// read this table — it exists for any server-side session bookkeeping you add).
// ============================================================================

export const sessions = pgTable('sessions', {
	id: id(),
	userId: varchar('user_id', { length: 21 })
		.notNull()
		.references(() => users.id),
	extraPrivileges: jsonb('extra_privileges'),
	lastLoginAt: ts('last_login_at'),
	createdAt: ts('created_at').defaultNow().notNull()
});

// ============================================================================
// Tokens (exclusive-arc: exactly one of user_id / admin_id is set)
// ============================================================================

export const tokens = pgTable(
	'tokens',
	{
		id: id(),
		userId: varchar('user_id', { length: 21 }).references(() => users.id),
		adminId: varchar('admin_id', { length: 21 }).references(() => adminUsers.id),
		purpose: tokenPurpose('purpose').notNull(),
		tokenHash: varchar('token_hash', { length: 128 }).notNull(),
		expiresAt: ts('expires_at').notNull(),
		attempts: integer('attempts').default(0).notNull(),
		payload: jsonb('payload'),
		createdAt: ts('created_at').defaultNow().notNull()
	},
	(t) => [
		check('tokens_exclusive_arc', sql`num_nonnulls(${t.userId}, ${t.adminId}) = 1`),
		index('tokens_hash_idx').on(t.tokenHash),
		index('tokens_user_purpose_idx').on(t.userId, t.purpose),
		index('tokens_admin_purpose_idx').on(t.adminId, t.purpose)
	]
);

// ============================================================================
// Operational tables
// ============================================================================

export const logs = pgTable('logs', {
	id: id(),
	timestamp: ts('timestamp').notNull(),
	level: logLevel('level').notNull(),
	context: jsonb('context').notNull(),
	data: jsonb('data').notNull()
});

export const config = pgTable('config', {
	key: varchar('key', { length: 128 }).primaryKey(),
	value: varchar('value', { length: 4096 }).notNull()
});

// ============================================================================
// Audit log (admin actions — accountability-relevant events).
// ============================================================================

export const auditLog = pgTable(
	'audit_log',
	{
		id: id(),
		adminId: varchar('admin_id', { length: 21 }).references(() => adminUsers.id),
		action: varchar('action', { length: 128 }).notNull(),
		entityType: varchar('entity_type', { length: 64 }),
		entityId: varchar('entity_id', { length: 24 }),
		payload: jsonb('payload'),
		createdAt: ts('created_at').defaultNow().notNull()
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
// jsonb payload. This is the demo CRUD resource the native mobile app (packages/mobile)
// drives end-to-end. Replace it with your real domain tables; it is safe to
// delete wholesale (this table, its relation + inferred type, the `item`
// public-id prefix, `lib/items.ts`, `routes/items.ts`, and the `/items` mount
// in `app.ts`) — nothing in the identity spine depends on it.
// ============================================================================

export const items = pgTable(
	'items',
	{
		id: id(),
		publicId: varchar('public_id', { length: 24 }).notNull().unique(),
		userId: varchar('user_id', { length: 21 })
			.notNull()
			.references(() => users.id),
		data: jsonb('data').notNull().default({}),
		createdAt: ts('created_at').defaultNow().notNull(),
		modifiedAt: ts('modified_at').defaultNow().notNull()
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
