import {
	checkLocalService,
	displayDateTime,
	displayMillisecondsFromMicroseconds,
	displayNumber,
	isLocalDiagnosticsEnabled,
	localServices,
	localServiceStatusBadgeClass
} from './admin-display';
import { getWorkerAnalytics, listWorkers } from './cloudflare';
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
