import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export default async function verifyPromotion({ github, context, sha }) {
	assert.equal(context.ref, 'refs/heads/main', 'Run production promotion from main');
	assert.match(sha, /^[a-f0-9]{40}$/, 'Provide a full commit SHA');
	const repo = context.repo;
	const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
		...repo,
		basehead: `${sha}...main`
	});
	assert.ok(['ahead', 'identical'].includes(comparison.status), 'Commit must belong to main');
	const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
		...repo,
		workflow_id: 'staging.yml',
		head_sha: sha,
		status: 'success',
		per_page: 100
	});
	for (const run of runs) {
		if (run.event !== 'push' || run.head_branch !== 'main') continue;
		const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
			...repo,
			run_id: run.id,
			filter: 'latest',
			per_page: 100
		});
		if (jobs.some((job) => job.name === 'deploy / deploy' && job.conclusion === 'success')) return;
	}
	throw new Error('Commit has no successful staging deployment');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const context = { ref: 'refs/heads/main', repo: { owner: 'test', repo: 'test' } };
	const sha = 'a'.repeat(40);
	let status = 'ahead',
		event = 'push',
		conclusion = 'success',
		headBranch = 'main',
		hasRun = true;
	const github = {
		rest: {
			repos: { compareCommitsWithBasehead: async () => ({ data: { status } }) },
			actions: { listWorkflowRuns: 'runs', listJobsForWorkflowRun: 'jobs' }
		},
		paginate: async (method) =>
			method === 'runs'
				? hasRun
					? [{ id: 1, event, head_branch: headBranch }]
					: []
				: [{ name: 'deploy / deploy', conclusion }]
	};
	await verifyPromotion({ github, context, sha });
	for (const value of ['behind', 'diverged']) {
		status = value;
		await assert.rejects(verifyPromotion({ github, context, sha }));
	}
	status = 'ahead';
	hasRun = false;
	await assert.rejects(verifyPromotion({ github, context, sha }));
	hasRun = true;
	headBranch = 'feature';
	await assert.rejects(verifyPromotion({ github, context, sha }));
	headBranch = 'main';
	conclusion = 'skipped';
	await assert.rejects(verifyPromotion({ github, context, sha }));
	conclusion = 'success';
	event = 'workflow_dispatch';
	await assert.rejects(verifyPromotion({ github, context, sha }));
	await assert.rejects(
		verifyPromotion({ github, context: { ...context, ref: 'refs/heads/feature' }, sha })
	);
	await assert.rejects(verifyPromotion({ github, context, sha: 'main' }));
	console.log('Promotion checks passed');
}
