import { requestState, type ApiRequestEvent } from './request-context.js';

export async function loadShell(
	{ context }: ApiRequestEvent,
	loadMe: () => Promise<{ ok: boolean; json(): Promise<unknown> }>
) {
	const {
		env,
		session: { auth }
	} = requestState(context);
	const environmentBanner =
		env.PUBLIC_ENV_BANNER === 'false'
			? ''
			: env.LOCAL_API_URL
				? 'Development'
				: env.PUBLIC_DEPLOY_ENVIRONMENT;
	if (!auth) return { viewer: null, environmentBanner };

	const response = await loadMe();
	const me = response.ok
		? ((await response.json().catch(() => null)) as Record<string, unknown> | null)
		: null;
	return {
		environmentBanner,
		viewer: {
			publicId: auth.sub,
			username: (me?.username as string) ?? auth.name ?? auth.email.split('@')[0],
			displayName: (me?.displayName as string | null) ?? auth.name ?? null,
			avatar: (me?.avatar as string | null) ?? null,
			email: auth.email,
			emailVerified:
				typeof me?.emailVerified === 'boolean' ? me.emailVerified : auth.emailConfirmed,
			role: auth.type
		}
	};
}
