import {
	checkLocalService,
	displayDateTime,
	displayLabel,
	displayMillisecondsFromMicroseconds,
	displayNumber,
	isLocalDiagnosticsEnabled,
	localServices,
	localServiceStatusBadgeClass,
	neonBranchResetAction,
	neonBranchRoleBadges,
	neonBranchStateBadgeClass
} from './admin-display';
import { getWorkerAnalytics, listWorkers } from './cloudflare';
import {
	getBranch,
	getProject,
	isProtectedBranch,
	listBranches,
	listEndpoints,
	resetBranchFromParent
} from './neon';
import type { Env } from '../types';

export function adminOpenRouterIntegration() {
	return {
		available: false,
		configured: false,
		message: 'OpenRouter is not used by ak5-web yet.',
		statusLabel: 'Not configured',
		statusBadgeClass: 'badge-ghost'
	};
}

export async function adminNeonIntegration(env: Env) {
	if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
		return {
			available: false,
			configured: false,
			message: 'Not configured.'
		};
	}

	try {
		const [project, branches, endpoints] = await Promise.all([
			getProject(env),
			listBranches(env),
			listEndpoints(env)
		]);

		const lastActiveByBranch = new Map<string, string>();
		for (const endpoint of endpoints) {
			if (!endpoint.last_active) continue;
			const existing = lastActiveByBranch.get(endpoint.branch_id);
			if (!existing || endpoint.last_active > existing) {
				lastActiveByBranch.set(endpoint.branch_id, endpoint.last_active);
			}
		}

		return {
			available: true,
			configured: true,
			project: {
				id: project.id,
				name: project.name,
				region: project.region_id,
				createdAt: project.created_at,
				createdLabel: displayDateTime(project.created_at),
				updatedAt: project.updated_at,
				updatedLabel: displayDateTime(project.updated_at)
			},
			branches: branches
				.map((branch) => {
					const state = branch.current_state ?? 'unknown';
					const updatedAt = branch.updated_at ?? null;
					const lastActive = lastActiveByBranch.get(branch.id) ?? null;
					const protectedBranch = isProtectedBranch(branch);
					return {
						id: branch.id,
						name: branch.name,
						isDefault: branch.default ?? false,
						isPrimary: branch.primary ?? false,
						isProtected: protectedBranch,
						roleBadges: neonBranchRoleBadges(branch),
						state,
						stateLabel: displayLabel(state),
						stateBadgeClass: neonBranchStateBadgeClass(state),
						updatedAt,
						updatedLabel: displayDateTime(updatedAt),
						lastActive,
						lastActiveLabel: displayDateTime(lastActive),
						consoleHref: `https://console.neon.tech/app/projects/${project.id}/branches/${branch.id}`,
						...neonBranchResetAction(branch.name, protectedBranch)
					};
				})
				.sort((a, b) => {
					const left = neonBranchSortOrder(a.name);
					const right = neonBranchSortOrder(b.name);
					if (left !== right) return left - right;
					return a.name.localeCompare(b.name);
				})
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Neon API unreachable.';
		return {
			available: false,
			configured: true,
			message,
			error: message
		};
	}
}

export async function adminResetNeonBranch(env: Env, branchId: string) {
	if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
		return { ok: false as const, status: 503 as const, body: { error: 'neon_not_configured' } };
	}

	const { branch } = await getBranch(env, branchId);
	if (isProtectedBranch(branch)) {
		return { ok: false as const, status: 403 as const, body: { error: 'protected_branch' } };
	}
	if (!branch.parent_id) {
		return { ok: false as const, status: 400 as const, body: { error: 'missing_parent_branch' } };
	}

	await resetBranchFromParent(env, branch.id, branch.parent_id);
	return { ok: true as const, body: { ok: true } };
}

export async function adminCloudflareIntegration(env: Env) {
	if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
		return {
			available: false,
			configured: false,
			message: 'Not configured.'
		};
	}

	try {
		const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const [workers, analytics] = await Promise.all([
			listWorkers(env),
			getWorkerAnalytics(env, since)
		]);
		const analyticsByScript = new Map(analytics.map((row) => [row.scriptName, row]));
		const appWorkers = workers.filter((worker) => worker.id.startsWith('ak5-'));

		return {
			available: true,
			configured: true,
			accountId: env.CLOUDFLARE_ACCOUNT_ID,
			workers: appWorkers.map((worker) => {
				const stats = analyticsByScript.get(worker.id);
				const requests24h = stats?.requests ?? 0;
				const errors24h = stats?.errors ?? 0;
				const cpuTimeP50 = stats?.cpuTimeP50 ?? 0;
				const cpuTimeP99 = stats?.cpuTimeP99 ?? 0;
				return {
					name: worker.id,
					dashboardHref: `https://dash.cloudflare.com/${env.CLOUDFLARE_ACCOUNT_ID}/workers/services/view/${worker.id}/production`,
					modifiedOn: worker.modified_on,
					modifiedLabel: displayDateTime(worker.modified_on),
					createdOn: worker.created_on,
					createdLabel: displayDateTime(worker.created_on),
					requests24h,
					requests24hLabel: displayNumber(requests24h),
					errors24h,
					errors24hLabel: displayNumber(errors24h),
					cpuTimeP50,
					cpuTimeP50Label: displayMillisecondsFromMicroseconds(cpuTimeP50),
					cpuTimeP99,
					cpuTimeP99Label: displayMillisecondsFromMicroseconds(cpuTimeP99)
				};
			})
		};
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Cloudflare API unreachable.';
		return {
			available: false,
			configured: true,
			message,
			error: message
		};
	}
}

export async function adminLocalIntegration(env: Env) {
	if (!isLocalDiagnosticsEnabled(env)) {
		return { available: false, services: [] };
	}

	const services = await Promise.all(
		localServices(env).map((service) => checkLocalService(service))
	);
	return {
		available: services.some((service) => service.ok),
		services: services.map((service) => ({
			...service,
			statusLabel: service.ok ? 'Online' : 'Offline',
			statusBadgeClass: localServiceStatusBadgeClass(service.ok)
		}))
	};
}

function neonBranchSortOrder(name: string) {
	const normalized = name.toLowerCase();
	if (normalized === 'main' || normalized === 'production' || normalized === 'prod') return 0;
	if (normalized === 'dev-template') return 1;
	return 2;
}
