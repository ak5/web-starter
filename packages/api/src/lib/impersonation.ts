import type { IssueJwtInput } from './jwt';

export const IMPERSONATION_SECONDS = 60 * 60;

type ImpersonationTarget = {
	publicId: string;
	username: string | null;
	email: string | null;
};

export function impersonationJwtClaims(
	target: ImpersonationTarget,
	adminPublicId: string,
	emailIdentityEmail: string | null | undefined,
	now = Math.floor(Date.now() / 1000)
): IssueJwtInput {
	// Impersonation is an admin-vouched debug session, not a real user login.
	// Bypass onboarding gates on this temporary JWT while leaving
	// the target user's persisted email/password state alone.
	return {
		sub: target.publicId,
		email: target.email ?? emailIdentityEmail ?? `${target.publicId}@ak5web.local`,
		name: target.username ?? target.publicId,
		type: 'user',
		emailConfirmed: true,
		hasPassword: true,
		recentAuthAt: now,
		impersonatedBy: adminPublicId
	};
}
