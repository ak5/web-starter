import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
	layout('routes/account-layout.tsx', [
		route('login', 'routes/login.tsx', { caseSensitive: true }),
		route('register', 'routes/register.tsx', { caseSensitive: true })
	]),
	route('account', 'routes/account.tsx', { caseSensitive: true }),
	route('account/password', 'routes/password.tsx', { caseSensitive: true }),
	route('auth/magic/:token', 'routes/magic.tsx', { caseSensitive: true }),
	route('forgot-password', 'routes/forgot-password.tsx', { caseSensitive: true }),
	route('invite', 'routes/invite.tsx', { caseSensitive: true }),
	route('items/:id/attachment', 'routes/item-attachment.ts', { caseSensitive: true }),
	route('items', 'routes/items.tsx', { caseSensitive: true }),
	route('logout', 'routes/logout.tsx', { caseSensitive: true }),
	route('account/verify', 'routes/verify.tsx', { caseSensitive: true }),
	route('dashboard', 'routes/dashboard.tsx', { caseSensitive: true }),
	route('notes', 'routes/notes.tsx', { caseSensitive: true }),
	route('sync', 'routes/sync.tsx', { caseSensitive: true }),
	route('*', 'routes/not-found.tsx')
] satisfies RouteConfig;
