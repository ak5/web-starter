import { HTTPException } from 'hono/http-exception';
import { createRateLimiter } from './in-memory-rate-limit';
import { getBranch, getEndpoint, isProtectedBranch, resetBranchFromParent } from './neon';
import type { Env } from '../types';

const resetLimiter = createRateLimiter(10_000, 1);

export async function resetDevBranchByEndpoint(env: Env, endpointId: string) {
	if (!resetLimiter.check(endpointId)) {
		throw new HTTPException(429, {
			message: 'Rate limited — wait 10 seconds between resets on the same endpoint'
		});
	}
	resetLimiter.increment(endpointId);

	const { endpoint } = await getEndpoint(env, endpointId);
	const branchId = endpoint.branch_id;

	const { branch } = await getBranch(env, branchId);

	if (isProtectedBranch(branch)) {
		throw new HTTPException(403, {
			message: 'Refusing to reset a protected branch (production, template, or root)'
		});
	}

	if (!branch.parent_id) {
		throw new HTTPException(403, {
			message: 'Branch has no parent — cannot reset'
		});
	}

	await resetBranchFromParent(env, branchId, branch.parent_id);

	return {
		endpointId,
		branchId,
		branchName: branch.name,
		resetAt: new Date().toISOString()
	};
}
