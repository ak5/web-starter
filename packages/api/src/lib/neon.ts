import { HTTPException } from 'hono/http-exception';
import type { Env } from '../types';
import { responseJson } from './request-parsing';

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

export interface NeonBranch {
	id: string;
	project_id: string;
	parent_id?: string | null;
	name: string;
	default?: boolean;
	primary?: boolean;
	current_state?: string;
	created_at?: string;
	updated_at?: string;
	last_reset_at?: string | null;
}

interface NeonBranchResponse {
	branch: NeonBranch;
}

export interface NeonEndpoint {
	id: string;
	project_id: string;
	branch_id: string;
	type?: string;
	current_state?: string;
	last_active?: string | null;
}

interface NeonEndpointResponse {
	endpoint: NeonEndpoint;
}

export interface NeonProject {
	id: string;
	name: string;
	region_id: string;
	created_at: string;
	updated_at: string;
	store_passwords: boolean;
}

function authHeaders(env: Env): Record<string, string> {
	if (!env.NEON_API_KEY) {
		throw new HTTPException(500, { message: 'NEON_API_KEY is not configured' });
	}
	if (!env.NEON_PROJECT_ID) {
		throw new HTTPException(500, { message: 'NEON_PROJECT_ID is not configured' });
	}
	return {
		Authorization: `Bearer ${env.NEON_API_KEY}`,
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};
}

async function readErrorBody(res: Response): Promise<string> {
	try {
		const text = await res.text();
		return text.length > 500 ? `${text.slice(0, 500)}…` : text;
	} catch {
		return '';
	}
}

export async function getEndpoint(env: Env, endpointId: string): Promise<NeonEndpointResponse> {
	const url = `${NEON_API_BASE}/projects/${env.NEON_PROJECT_ID}/endpoints/${endpointId}`;
	const res = await fetch(url, { headers: authHeaders(env) });
	if (res.status === 404) {
		throw new HTTPException(404, { message: 'Endpoint not found' });
	}
	if (!res.ok) {
		const body = await readErrorBody(res);
		throw new HTTPException(502, {
			message: `Neon getEndpoint failed (${res.status}): ${body}`
		});
	}
	return responseJson<NeonEndpointResponse>(res);
}

export async function getBranch(env: Env, branchId: string): Promise<NeonBranchResponse> {
	const url = `${NEON_API_BASE}/projects/${env.NEON_PROJECT_ID}/branches/${branchId}`;
	const res = await fetch(url, { headers: authHeaders(env) });
	if (res.status === 404) {
		throw new HTTPException(404, { message: 'Branch not found' });
	}
	if (!res.ok) {
		const body = await readErrorBody(res);
		throw new HTTPException(502, {
			message: `Neon getBranch failed (${res.status}): ${body}`
		});
	}
	return responseJson<NeonBranchResponse>(res);
}

export async function resetBranchFromParent(
	env: Env,
	branchId: string,
	parentBranchId: string
): Promise<void> {
	const url = `${NEON_API_BASE}/projects/${env.NEON_PROJECT_ID}/branches/${branchId}/restore`;
	const res = await fetch(url, {
		method: 'POST',
		headers: authHeaders(env),
		body: JSON.stringify({ source_branch_id: parentBranchId })
	});
	if (res.status === 404) {
		throw new HTTPException(404, { message: 'Branch not found' });
	}
	if (!res.ok) {
		const body = await readErrorBody(res);
		throw new HTTPException(502, {
			message: `Neon restore branch failed (${res.status}): ${body}`
		});
	}
}

export async function getProject(env: Env): Promise<NeonProject> {
	const url = `${NEON_API_BASE}/projects/${env.NEON_PROJECT_ID}`;
	const res = await fetch(url, { headers: authHeaders(env) });
	if (!res.ok) {
		const body = await readErrorBody(res);
		throw new HTTPException(502, {
			message: `Neon getProject failed (${res.status}): ${body}`
		});
	}

	const data = await responseJson<{ project: NeonProject }>(res);
	return data.project;
}

export async function listBranches(env: Env): Promise<NeonBranch[]> {
	const url = `${NEON_API_BASE}/projects/${env.NEON_PROJECT_ID}/branches`;
	const res = await fetch(url, { headers: authHeaders(env) });
	if (!res.ok) {
		const body = await readErrorBody(res);
		throw new HTTPException(502, {
			message: `Neon listBranches failed (${res.status}): ${body}`
		});
	}

	const data = await responseJson<{ branches: NeonBranch[] }>(res);
	return data.branches;
}

export async function listEndpoints(env: Env): Promise<NeonEndpoint[]> {
	const url = `${NEON_API_BASE}/projects/${env.NEON_PROJECT_ID}/endpoints`;
	const res = await fetch(url, { headers: authHeaders(env) });
	if (!res.ok) {
		const body = await readErrorBody(res);
		throw new HTTPException(502, {
			message: `Neon listEndpoints failed (${res.status}): ${body}`
		});
	}

	const data = await responseJson<{ endpoints: NeonEndpoint[] }>(res);
	return data.endpoints;
}

const PROTECTED_NAME_RE = /^(main|prod|production|default)$/i;

/**
 * Refuses to touch any branch that resembles production or a template:
 *   - default / primary branches
 *   - root branches (no parent_id) — these are the templates collaborators fork from
 *   - branches whose name matches main / prod / production / default
 */
export function isProtectedBranch(branch: NeonBranch): boolean {
	if (branch.default === true) return true;
	if (branch.primary === true) return true;
	if (!branch.parent_id) return true;
	if (PROTECTED_NAME_RE.test(branch.name ?? '')) return true;
	return false;
}
