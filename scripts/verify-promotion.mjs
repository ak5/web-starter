import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export default async function verifyPromotion({
	github,
	context,
	sha,
	target = 'production',
	hostedDev = true,
	staging = false
}) {
	assert.equal(context.ref, 'refs/heads/main', 'Run promotion from main');
	assert.match(sha, /^[a-f0-9]{40}$/, 'Provide a full commit SHA');
	assert.ok(['staging', 'production'].includes(target), 'Invalid promotion target');
	assert.ok(target !== 'staging' || staging, 'Set ENABLE_STAGING=true before promoting to staging');
	const repo = context.repo;
	const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
		...repo,
		basehead: `${sha}...main`
	});
	assert.ok(['ahead', 'identical'].includes(comparison.status), 'Commit must belong to main');
	const source = target === 'production' && staging ? 'staging' : hostedDev ? 'development' : 'ci';
	const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
		...repo,
		workflow_id: source === 'staging' ? 'promote.yml' : 'development.yml',
		...(source === 'staging' ? {} : { head_sha: sha }),
		status: 'success',
		per_page: 100
	});
	for (const run of runs) {
		if (
			run.head_branch !== 'main' ||
			run.event !== (source === 'staging' ? 'workflow_dispatch' : 'push')
		)
			continue;
		const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
			...repo,
			run_id: run.id,
			filter: 'latest',
			per_page: 100
		});
		const jobName = source === 'ci' ? 'test / e2e' : 'deploy / deploy';
		if (!jobs.some((job) => job.name === jobName && job.conclusion === 'success')) continue;
		if (source === 'ci') return;
		// Deployment receipts expire after 90 days; revalidate a candidate before promoting it later.
		const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
			...repo,
			run_id: run.id,
			per_page: 100
		});
		if (
			artifacts.some(
				(artifact) => !artifact.expired && artifact.name === `deployment-${source}-${sha}`
			)
		)
			return;
	}
	throw new Error(`Commit has no successful ${source} qualification`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const context = { ref: 'refs/heads/main', repo: { owner: 'test', repo: 'test' } };
	const sha = 'a'.repeat(40);
	let status = 'ahead',
		event = 'push',
		conclusion = 'success',
		headBranch = 'main',
		hasRun = true,
		artifactName = `deployment-development-${sha}`,
		expired = false,
		jobName = 'deploy / deploy';
	const calls = [];
	const github = {
		rest: {
			repos: { compareCommitsWithBasehead: async () => ({ data: { status } }) },
			actions: {
				listWorkflowRuns: 'runs',
				listJobsForWorkflowRun: 'jobs',
				listWorkflowRunArtifacts: 'artifacts'
			}
		},
		paginate: async (method, args) => {
			calls.push([method, args]);
			if (method === 'runs') return hasRun ? [{ id: 1, event, head_branch: headBranch }] : [];
			if (method === 'jobs') return [{ name: jobName, conclusion }];
			return [{ name: artifactName, expired }];
		}
	};
	const verify = (options = {}) => verifyPromotion({ github, context, sha, ...options });
	await verify();
	assert.equal(calls[0][1].head_sha, sha);
	for (const value of ['behind', 'diverged']) {
		status = value;
		await assert.rejects(verify());
	}
	status = 'ahead';
	hasRun = false;
	await assert.rejects(verify());
	hasRun = true;
	headBranch = 'feature';
	await assert.rejects(verify());
	headBranch = 'main';
	conclusion = 'skipped';
	await assert.rejects(verify());
	conclusion = 'success';
	expired = true;
	await assert.rejects(verify());
	expired = false;
	artifactName = `deployment-development-${'b'.repeat(40)}`;
	await assert.rejects(verify());
	artifactName = `deployment-production-${sha}`;
	await assert.rejects(verify());
	artifactName = `deployment-development-${sha}`;
	event = 'pull_request';
	await assert.rejects(verify());
	event = 'workflow_dispatch';
	await assert.rejects(verify());
	// A manual staging run's control SHA can differ from its explicitly deployed SHA.
	artifactName = `deployment-staging-${sha}`;
	calls.length = 0;
	await verify({ staging: true });
	assert.equal(calls[0][1].workflow_id, 'promote.yml');
	assert.equal(calls[0][1].head_sha, undefined);
	await assert.rejects(verify({ staging: true, target: 'staging' }));
	event = 'push';
	artifactName = `deployment-development-${sha}`;
	await verify({ staging: true, target: 'staging' });
	await assert.rejects(verify({ target: 'staging' }));
	await assert.rejects(verify({ target: 'development' }));
	jobName = 'test / e2e';
	await verify({ hostedDev: false });
	await verify({ hostedDev: false, staging: true, target: 'staging' });
	await assert.rejects(verify());
	await assert.rejects(verify({ hostedDev: false, staging: true }));
	conclusion = 'failure';
	await assert.rejects(verify({ hostedDev: false }));
	await assert.rejects(verify({ context: { ...context, ref: 'refs/heads/feature' } }));
	await assert.rejects(verify({ sha: 'main' }));
	console.log(
		'Promotion checks passed: all four environment profiles, exact SHA, origin and failure cases'
	);
}
