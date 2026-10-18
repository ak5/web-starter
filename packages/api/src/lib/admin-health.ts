import { count, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { adminUsers, users } from '../db/schema';
import {
	displayDateTime,
	displayLabel,
	healthStatusBadgeClass,
	healthStatusIcon
} from './admin-display';

type AdminHealthCheck = {
	name: string;
	target: string;
	status: 'ok' | 'warning' | 'error';
	message: string;
};

export async function adminHealthReport(db: Database) {
	const generatedAt = new Date();
	const checks: AdminHealthCheck[] = [];

	try {
		await db.run(sql`SELECT 1`);
		checks.push({
			name: 'Database',
			target: 'Cloudflare D1',
			status: 'ok',
			message: 'Query succeeded'
		});
	} catch (e) {
		checks.push({
			name: 'Database',
			target: 'Cloudflare D1',
			status: 'error',
			message: e instanceof Error ? e.message : String(e)
		});
	}

	const [userCount, adminCount] = await Promise.all([
		db.select({ count: count() }).from(users),
		db.select({ count: count() }).from(adminUsers)
	]);

	checks.push({
		name: 'Admin auth',
		target: 'JWT boundary',
		status: 'ok',
		message: 'Request was accepted by admin-only middleware'
	});
	checks.push({
		name: 'Users',
		target: 'users',
		status: 'ok',
		message: `${userCount[0]?.count ?? 0} users`
	});
	checks.push({
		name: 'Admin users',
		target: 'admin_users',
		status: (adminCount[0]?.count ?? 0) > 0 ? 'ok' : 'warning',
		message: `${adminCount[0]?.count ?? 0} admin users`
	});

	const status = checks.some((check) => check.status === 'error')
		? 'error'
		: checks.some((check) => check.status === 'warning')
			? 'warning'
			: 'ok';
	const summary = {
		ok: checks.filter((check) => check.status === 'ok').length,
		warning: checks.filter((check) => check.status === 'warning').length,
		error: checks.filter((check) => check.status === 'error').length
	};
	const decoratedChecks = checks.map((check) => ({
		...check,
		statusLabel: displayLabel(check.status),
		statusBadgeClass: healthStatusBadgeClass(check.status),
		statusIcon: healthStatusIcon(check.status)
	}));

	return {
		generatedAt,
		generatedLabel: displayDateTime(generatedAt),
		status,
		statusLabel: displayLabel(status),
		statusBadgeClass: healthStatusBadgeClass(status),
		statusIcon: healthStatusIcon(status),
		checks: decoratedChecks,
		summary
	};
}
