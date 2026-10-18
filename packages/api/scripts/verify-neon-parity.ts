#!/usr/bin/env tsx
/**
 * Verify the live Neon project matches the expected branch layout.
 *
 * Required env:
 *   NEON_API_KEY
 *   NEON_PROJECT_ID
 *
 * Optional but recommended env:
 *   DATABASE_URL
 *   DATABASE_URL_TEST
 *
 * This is read-only. It calls Neon's project/branch/endpoint APIs and exits
 * non-zero when branch topology or dev/test URL separation violates the local
 * reset model documented in docs/development/database.md.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { responseJson } from '../src/lib/request-parsing';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..');
const envPath = join(apiRoot, '.env');
const NEON_API_BASE = 'https://console.neon.tech/api/v2';

interface NeonBranch {
	id: string;
	parent_id?: string | null;
	name: string;
	default?: boolean;
	primary?: boolean;
}

interface NeonEndpoint {
	id: string;
	branch_id: string;
	host?: string;
}

interface NeonProject {
	id: string;
	name: string;
}

function localEnv(): Record<string, string> {
	try {
		return Object.fromEntries(
			readFileSync(envPath, 'utf8')
				.split(/\r?\n/)
				.map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\n#]*)/))
				.filter((match): match is RegExpMatchArray => Boolean(match))
				.map((match) => [match[1], match[2].trim()])
		);
	} catch {
		return {};
	}
}

const fallbackEnv = localEnv();
function env(name: string): string | undefined {
	return process.env[name]?.trim() || fallbackEnv[name]?.trim() || undefined;
}

interface NeonUrlInfo {
	endpointId: string;
	pooled: boolean;
}

function neonUrlInfo(raw: string | undefined): NeonUrlInfo | null {
	if (!raw) return null;
	try {
		const host = new URL(raw).hostname;
		if (!host.endsWith('.neon.tech')) return null;
		const endpointHost = host.split('.')[0];
		return {
			endpointId: endpointHost.replace(/-pooler$/, ''),
			pooled: endpointHost.endsWith('-pooler')
		};
	} catch {
		return null;
	}
}

async function neonGet<T>(path: string): Promise<T> {
	const apiKey = env('NEON_API_KEY');
	const projectId = env('NEON_PROJECT_ID');
	if (!apiKey || !projectId) {
		throw new Error('NEON_API_KEY and NEON_PROJECT_ID are required.');
	}

	const res = await fetch(`${NEON_API_BASE}/projects/${projectId}${path}`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
			Accept: 'application/json'
		}
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Neon API ${path} failed (${res.status}): ${body.slice(0, 500)}`);
	}
	return responseJson<T>(res);
}

function protectedByResetGuard(branch: NeonBranch): boolean {
	if (branch.default === true) return true;
	if (branch.primary === true) return true;
	if (!branch.parent_id) return true;
	return /^(main|prod|production|default)$/i.test(branch.name);
}

function fail(errors: string[]): never {
	console.error('Neon parity check failed:');
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

async function main() {
	const projectId = env('NEON_PROJECT_ID');
	const [{ project }, { branches }, { endpoints }] = await Promise.all([
		neonGet<{ project: NeonProject }>(''),
		neonGet<{ branches: NeonBranch[] }>('/branches'),
		neonGet<{ endpoints: NeonEndpoint[] }>('/endpoints')
	]);

	const errors: string[] = [];
	if (project.id !== projectId) {
		errors.push(`NEON_PROJECT_ID points at ${projectId}, but Neon returned project ${project.id}.`);
	}

	const byName = new Map(branches.map((branch) => [branch.name, branch]));
	const devTemplate = byName.get('dev-template');
	if (!devTemplate) {
		errors.push('Missing root branch named dev-template.');
	} else if (devTemplate.parent_id) {
		errors.push('dev-template must be a root branch with no parent_id.');
	}

	const testBranch = byName.get('test');
	if (!testBranch) {
		errors.push('Missing dedicated branch named test.');
	} else if (!testBranch.parent_id) {
		errors.push('test branch must be forked from a parent branch, not created as a root branch.');
	} else if (devTemplate && testBranch.parent_id !== devTemplate.id) {
		errors.push('test branch should be forked from dev-template.');
	}

	for (const branch of branches) {
		if (
			(branch.default || branch.primary || /^(main|prod|production|default)$/i.test(branch.name)) &&
			!protectedByResetGuard(branch)
		) {
			errors.push(`Production-like branch ${branch.name} is not protected by the reset guard.`);
		}
	}

	if (devTemplate) {
		for (const branch of branches) {
			if (branch.name === 'dev-template' || branch.name === 'test') continue;
			if (protectedByResetGuard(branch)) continue;
			if (branch.parent_id !== devTemplate.id) {
				errors.push(
					`Collaborator branch ${branch.name} should be forked from dev-template, not ${branch.parent_id ?? 'root'}.`
				);
			}
		}
	}

	const endpointBranch = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint.branch_id]));
	const branchById = new Map(branches.map((branch) => [branch.id, branch]));
	const devUrl = env('DATABASE_URL');
	const testUrl = env('DATABASE_URL_TEST');
	const devEndpoint = neonUrlInfo(devUrl);
	const testEndpoint = neonUrlInfo(testUrl);

	if (devUrl && !devEndpoint) {
		errors.push('DATABASE_URL is set but is not a Neon connection string.');
	}
	if (testUrl && !testEndpoint) {
		errors.push('DATABASE_URL_TEST is set but is not a Neon connection string.');
	}
	if (devEndpoint?.pooled) {
		errors.push(
			'DATABASE_URL uses a Neon pooler endpoint; local dev should use the direct/non-pooler URL.'
		);
	}
	if (testEndpoint?.pooled) {
		errors.push(
			'DATABASE_URL_TEST uses a Neon pooler endpoint; tests should use the direct/non-pooler URL.'
		);
	}

	if (devEndpoint && !endpointBranch.has(devEndpoint.endpointId)) {
		errors.push('DATABASE_URL endpoint was not found in the configured Neon project.');
	}
	if (testEndpoint && !endpointBranch.has(testEndpoint.endpointId)) {
		errors.push('DATABASE_URL_TEST endpoint was not found in the configured Neon project.');
	}

	if (devEndpoint && testEndpoint && devEndpoint.endpointId === testEndpoint.endpointId) {
		errors.push('DATABASE_URL_TEST uses the same Neon endpoint as DATABASE_URL.');
	}
	if (devEndpoint && testEndpoint) {
		const devBranchId = endpointBranch.get(devEndpoint.endpointId);
		const testBranchId = endpointBranch.get(testEndpoint.endpointId);
		const devBranch = devBranchId ? branchById.get(devBranchId) : undefined;
		if (devBranchId && testBranchId && devBranchId === testBranchId) {
			errors.push('DATABASE_URL_TEST resolves to the same Neon branch as DATABASE_URL.');
		}
		if (devBranch && protectedByResetGuard(devBranch)) {
			errors.push(
				'DATABASE_URL resolves to a protected/root branch; use a collaborator branch forked from dev-template.'
			);
		}
		if (testBranch && testBranchId && testBranchId !== testBranch.id) {
			errors.push('DATABASE_URL_TEST does not resolve to the dedicated test branch.');
		}
	}

	if (errors.length) fail(errors);

	console.log(`Neon parity check passed for ${project.name} (${project.id}).`);
	console.log(`Branches checked: ${branches.length}; endpoints checked: ${endpoints.length}.`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(2);
});
