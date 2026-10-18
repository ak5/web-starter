export function displayLabel(value: string) {
	return value.replaceAll('_', ' ');
}

export function displayNumber(value: number) {
	return new Intl.NumberFormat('en-US').format(value);
}

export function displayMoney(cents: number) {
	return `$${(cents / 100).toFixed(2)}`;
}

export function displayDollarsInput(cents: number) {
	return (cents / 100).toFixed(2);
}

export function displayDate(value: Date | string | null | undefined) {
	return value ? new Date(value).toLocaleDateString('en-US') : '-';
}

export function displayDateTime(value: Date | string | null | undefined) {
	return value ? new Date(value).toLocaleString('en-US') : '-';
}

export function displayOptional(value: string | null | undefined) {
	return value?.trim() ? value : '—';
}

export function displayJsonPayload(value: unknown) {
	return value ? JSON.stringify(value, null, 2) : null;
}

export function displayMillisecondsFromMicroseconds(value: number) {
	return `${(value / 1000).toFixed(1)}ms`;
}

export function withdrawalStatusBadgeClass(status: string) {
	if (status === 'requested' || status === 'approved') return 'badge-warning';
	if (status === 'paid' || status === 'processed') return 'badge-success';
	if (status === 'failed' || status === 'rejected' || status === 'cancelled') return 'badge-error';
	return 'badge-ghost';
}

export const channelFilterStatuses = ['all', 'errors'] as const;

export const channelFilterStatusOptions = [
	{ value: 'all', label: 'All channels' },
	{ value: 'errors', label: 'Errors only' }
] satisfies Array<{ value: (typeof channelFilterStatuses)[number]; label: string }>;

export function channelStatus(value?: string) {
	return channelFilterStatuses.includes(value as (typeof channelFilterStatuses)[number])
		? (value as (typeof channelFilterStatuses)[number])
		: 'all';
}

export function healthStatusBadgeClass(status: string) {
	if (status === 'ok') return 'badge-success';
	if (status === 'warning') return 'badge-warning';
	return 'badge-error';
}

export function healthStatusIcon(status: string) {
	if (status === 'ok') return 'circle-check';
	if (status === 'warning') return 'triangle-alert';
	return 'circle-x';
}

export function localServiceStatusBadgeClass(ok: boolean) {
	return ok ? 'badge-success' : 'badge-error';
}

export function neonBranchStateBadgeClass(state: string) {
	if (state === 'ready') return 'badge-success';
	if (state === 'init') return 'badge-warning';
	return 'badge-ghost';
}

export function neonBranchRoleBadges(branch: {
	default?: boolean | null;
	primary?: boolean | null;
}) {
	return [
		branch.default
			? {
					label: 'default',
					badgeClass: 'badge-primary'
				}
			: null,
		branch.primary
			? {
					label: 'primary',
					badgeClass: 'badge-warning'
				}
			: null
	].filter((badge): badge is { label: string; badgeClass: string } => badge !== null);
}

export function neonBranchResetAction(branchName: string, protectedBranch: boolean) {
	return {
		canReset: !protectedBranch,
		resetLabel: 'Reset',
		resettingLabel: 'Resetting',
		resetConfirmation: protectedBranch ? null : `Reset Neon branch "${branchName}" from its parent?`
	};
}

export function formatAddressPreview(address: string) {
	return address.length <= 14 ? address : `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function payloadKeys(payload: unknown) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
	return Object.keys(payload);
}

export type LocalServiceDefinition = {
	name: string;
	url: string;
	upstreamPort: number;
};

export type LocalDiagnosticsEnv = {
	PUBLIC_API_URL: string;
	PUBLIC_APP_URL: string;
	PUBLIC_ADMIN_URL: string;
	EMAIL_MOCK_URL?: string;
};

function isLocalServiceUrl(value: string) {
	const url = new URL(value);
	return (
		url.protocol === 'http:' ||
		url.hostname === 'localhost' ||
		url.hostname === '127.0.0.1' ||
		url.hostname.endsWith('.localhost')
	);
}

export function isLocalDiagnosticsEnabled(env: LocalDiagnosticsEnv) {
	return isLocalServiceUrl(env.PUBLIC_APP_URL) || isLocalServiceUrl(env.PUBLIC_API_URL);
}

export function withPath(baseUrl: string, path: string) {
	const url = new URL(baseUrl);
	url.pathname = path;
	url.search = '';
	url.hash = '';
	return url.toString();
}

function inferSlotBasePort(apiUrl: string) {
	const url = new URL(apiUrl);
	const port = Number(url.port);
	if (!Number.isFinite(port)) return 8350;
	return port % 10 === 9 ? port - 9 : port;
}

function deriveEmailPreviewUrl(emailApiUrl: string) {
	const url = new URL(emailApiUrl);
	if (url.hostname.startsWith('mock.')) {
		url.hostname = url.hostname.replace(/^mock\./, 'preview.');
	} else if (url.port) {
		url.port = String(Math.max(1, Number(url.port) - 1));
	}
	url.pathname = '/';
	url.search = '';
	url.hash = '';
	return url.toString();
}

export function localServices(env: LocalDiagnosticsEnv): LocalServiceDefinition[] {
	const basePort = inferSlotBasePort(env.PUBLIC_API_URL);
	const services = [
		{ name: 'API', url: withPath(env.PUBLIC_API_URL, '/healthz'), upstreamPort: basePort },
		{ name: 'Web', url: withPath(env.PUBLIC_APP_URL, '/'), upstreamPort: basePort + 1 },
		{ name: 'Admin', url: withPath(env.PUBLIC_ADMIN_URL, '/login'), upstreamPort: basePort + 2 }
	];

	if (!env.EMAIL_MOCK_URL) return services;

	return [
		...services,
		{
			name: 'Email Preview',
			url: deriveEmailPreviewUrl(env.EMAIL_MOCK_URL),
			upstreamPort: basePort + 4
		},
		{
			name: 'Email Mock',
			url: withPath(env.EMAIL_MOCK_URL, '/emails'),
			upstreamPort: basePort + 5
		}
	];
}

export async function checkLocalService(service: LocalServiceDefinition) {
	try {
		const res = await fetch(service.url, {
			signal: AbortSignal.timeout(2000)
		});
		return { ...service, ok: res.ok, status: res.status };
	} catch {
		return { ...service, ok: false, status: null };
	}
}
