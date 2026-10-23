import type { Env } from '../types';
import { responseJson } from './request-parsing';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface CfWorkerScript {
	id: string;
	modified_on: string;
	created_on: string;
}

export interface CfWorkerAnalytics {
	scriptName: string;
	requests: number;
	errors: number;
	cpuTimeP50: number;
	cpuTimeP99: number;
}

function authHeaders(env: Env): Record<string, string> {
	return {
		Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
		'Content-Type': 'application/json'
	};
}

export async function listWorkers(env: Env): Promise<CfWorkerScript[]> {
	const url = `${CF_API_BASE}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts`;
	const res = await fetch(url, { headers: authHeaders(env) });
	if (!res.ok) return [];

	const data = await responseJson<{ result?: CfWorkerScript[] }>(res);
	return data.result ?? [];
}

export async function getWorkerAnalytics(env: Env, since: string): Promise<CfWorkerAnalytics[]> {
	const query = `
		query {
			viewer {
				accounts(filter: { accountTag: "${env.CLOUDFLARE_ACCOUNT_ID}" }) {
					workersInvocationsAdaptive(
						filter: { datetime_gt: "${since}" }
						limit: 50
						orderBy: [sum_requests_DESC]
					) {
						dimensions { scriptName }
						sum { requests errors subrequests }
						quantiles { cpuTimeP50 cpuTimeP99 }
					}
				}
			}
		}
	`;

	const res = await fetch(`${CF_API_BASE}/graphql`, {
		method: 'POST',
		headers: authHeaders(env),
		body: JSON.stringify({ query })
	});
	if (!res.ok) return [];

	const data = await responseJson<{
		data?: {
			viewer?: {
				accounts?: Array<{
					workersInvocationsAdaptive?: Array<{
						dimensions: { scriptName: string };
						sum: { requests: number; errors: number };
						quantiles: { cpuTimeP50: number; cpuTimeP99: number };
					}>;
				}>;
			};
		};
	}>(res);

	const rows = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
	return rows.map((row) => ({
		scriptName: row.dimensions.scriptName,
		requests: row.sum.requests,
		errors: row.sum.errors,
		cpuTimeP50: row.quantiles.cpuTimeP50,
		cpuTimeP99: row.quantiles.cpuTimeP99
	}));
}
