import { index, layout, route, type RouteConfig } from '@react-router/dev/routes';

export default [
	index('routes/home.tsx'),
	layout('routes/account-layout.tsx', [
		route('login', 'routes/login.tsx', { caseSensitive: true })
	]),
	route('account/password', 'routes/password.tsx', { caseSensitive: true }),
	route('auth/magic/:token', 'routes/magic.tsx', { caseSensitive: true }),
	route('forgot-password', 'routes/forgot-password.tsx', { caseSensitive: true }),
	route('invite', 'routes/invite.tsx', { caseSensitive: true }),
	route('items', 'routes/items.tsx', { caseSensitive: true }),
	route('logout', 'routes/logout.tsx', { caseSensitive: true }),
	route('*', 'routes/not-found.tsx')
] satisfies RouteConfig;
