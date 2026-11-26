import { data as actionData, redirect, redirectDocument } from 'react-router';

import { apiErrorBody, apiErrorMessage } from './api-error.js';
import { errorMessage } from './error-messages.js';
import { forwardSetCookie } from './forward-cookie.js';
import { responseJsonBody } from './proxy-json.js';
import { getReauthMagicRedirectPath, getSafeLocalRedirectPath } from './redirect-paths.js';

type ResponseLike = {
	ok: boolean;
	status: number;
	json(): Promise<unknown>;
	headers: Headers;
};

type AcceptInviteInput = {
	password: string;
	passwordConfirm: string;
	token: string;
};

type MagicLoginInput = {
	token: string;
};

type LoginInput = {
	email: string;
	password: string;
};

type LogoutInput = undefined;

type ForgotPasswordInput = {
	email: string;
};

type AcceptInvitePasswordInput = {
	password: string;
	passwordConfirm: string;
	token: string;
};

type SetPasswordInput = {
	newPassword: string;
};

type ChangePasswordInput = {
	currentPassword: string;
	newPassword: string;
};

type AuthState = {
	hasPassword: boolean;
};

type UrlSource = URL | { url: URL };

type PasswordErrorBody = {
	code?: string;
	error?: string;
	message?: string;
};

export type AcceptInviteEvent = {
	acceptInvite: (input: AcceptInviteInput) => Promise<ResponseLike>;
	cookies: Headers;
	request: Request;
};

export type ForgotPasswordEvent = {
	forgotPassword: (input: ForgotPasswordInput) => Promise<ResponseLike>;
	request: Request;
};

export type LoginEvent = {
	cookies: Headers;
	failureIncludesEmail?: boolean;
	login: (input: LoginInput) => Promise<ResponseLike>;
	request: Request;
	successRedirect: string;
	url?: URL;
};

export type LogoutEvent = {
	cookies: Headers;
	logout: (input?: LogoutInput) => Promise<ResponseLike>;
	redirectTo: string;
};

export type MagicLoginEvent = {
	cookies: Headers;
	magicLogin: (input: MagicLoginInput) => Promise<ResponseLike>;
	next?: string | null;
	params?: { token?: string };
	token?: string;
	url?: URL;
};

export type AccountPasswordEvent = {
	acceptInvite: (input: AcceptInvitePasswordInput) => Promise<ResponseLike>;
	changePassword: (input: ChangePasswordInput) => Promise<ResponseLike>;
	cookies: Headers;
	session: { auth?: AuthState | null };
	request: Request;
	setPassword: (input: SetPasswordInput) => Promise<ResponseLike>;
	unauthenticatedRedirect?: string;
	failures: {
		acceptInvite: string;
		changePassword: string;
		setPassword: string;
	};
	includeFailureCode?: boolean;
	includeResetTokenOnFailure?: boolean;
};

export type AccountPasswordLoadEvent = UrlSource & {
	session: { auth?: AuthState | null };
};

function urlFrom(source: UrlSource): URL {
	return source instanceof URL ? source : source.url;
}

export function loadInvite(source: UrlSource) {
	const url = urlFrom(source);
	return { token: url.searchParams.get('t') ?? '' };
}

export function loadAccountPasswordToken(source: UrlSource) {
	const url = urlFrom(source);
	return { resetToken: url.searchParams.get('t') ?? '' };
}

export function loadAccountPassword(
	source: AccountPasswordLoadEvent,
	unauthenticatedRedirect = '/login'
) {
	const data = loadAccountPasswordToken(source);
	if (!source.session.auth && !data.resetToken) throw redirect(unauthenticatedRedirect, 303);
	return data;
}

function passwordFailure(
	res: ResponseLike,
	body: PasswordErrorBody,
	error: string,
	event: AccountPasswordEvent,
	token?: string
) {
	return actionData(
		{
			error,
			...(event.includeFailureCode ? { code: body.code } : {}),
			...(event.includeResetTokenOnFailure && token !== undefined ? { token } : {})
		},
		{ status: res.status }
	);
}

export async function acceptInviteAction(event: AcceptInviteEvent) {
	const data = await event.request.formData();
	const token = String(data.get('token') ?? '');
	const password = String(data.get('password') ?? '');
	const password2 = String(data.get('password2') ?? '');

	const res = await event.acceptInvite({ token, password, passwordConfirm: password2 });
	if (!res.ok) {
		return actionData(
			{
				error: await apiErrorMessage(res, 'Could not accept invite'),
				token
			},
			{ status: res.status }
		);
	}

	const body = await responseJsonBody<{ redirectTo: string }>(res, { redirectTo: '/' });
	forwardSetCookie(res, event.cookies);
	throw redirect(body.redirectTo, 303);
}

export async function forgotPasswordAction(event: ForgotPasswordEvent) {
	const data = await event.request.formData();
	const email = String(data.get('email') ?? '');
	const res = await event.forgotPassword({ email });
	if (!res.ok)
		return actionData(
			{
				error: await apiErrorMessage(res, 'Could not request a reset link.')
			},
			{ status: res.status }
		);
	return responseJsonBody<{ successMessage: string }>(res, {
		successMessage: 'If that account exists, a reset link has been sent.'
	});
}

export async function loginAction(event: LoginEvent) {
	const data = await event.request.formData();
	const email = String(data.get('email') ?? '');
	const password = String(data.get('password') ?? '');

	const res = await event.login({ email, password });
	if (!res.ok) {
		const body = (await apiErrorBody(res)) as { error?: string };
		return actionData(
			{
				error: errorMessage(body.error, 'Invalid credentials'),
				...(event.failureIncludesEmail ? { email } : {})
			},
			{ status: res.status }
		);
	}

	forwardSetCookie(res, event.cookies);
	const next =
		getSafeLocalRedirectPath(event.url?.searchParams.get('next') ?? null, event.successRedirect) ??
		event.successRedirect;
	const navigate = next.startsWith('/oauth/authorize?') ? redirectDocument : redirect;
	throw navigate(next, 303);
}

export async function accountPasswordAction(event: AccountPasswordEvent) {
	const data = await event.request.formData();
	const token = String(data.get('token') ?? '');
	const newPassword = String(data.get('newPassword') ?? '');
	const password2 = String(data.get('password2') ?? '');
	if (newPassword !== password2)
		return actionData({ error: 'Passwords do not match.' }, { status: 400 });

	if (token) {
		const res = await event.acceptInvite({
			token,
			password: newPassword,
			passwordConfirm: password2
		});
		if (!res.ok) {
			const body = (await apiErrorBody(res)) as PasswordErrorBody;
			return passwordFailure(
				res,
				body,
				await apiErrorMessage(res, event.failures.acceptInvite, body),
				event,
				token
			);
		}
		const body = await responseJsonBody<{ redirectTo: string }>(res, { redirectTo: '/' });
		forwardSetCookie(res, event.cookies);
		throw redirect(body.redirectTo, 303);
	}

	if (!event.session.auth) {
		throw redirect(event.unauthenticatedRedirect ?? '/login', 303);
	}

	if (!event.session.auth.hasPassword) {
		const res = await event.setPassword({ newPassword });
		if (!res.ok) {
			const body = (await apiErrorBody(res)) as PasswordErrorBody;
			return passwordFailure(
				res,
				body,
				await apiErrorMessage(res, event.failures.setPassword, body),
				event
			);
		}
		forwardSetCookie(res, event.cookies);
		return responseJsonBody<{ ok: boolean; successMessage: string }>(res, {
			ok: true,
			successMessage: 'Password updated.'
		});
	}

	const currentPassword = String(data.get('currentPassword') ?? '');
	const res = await event.changePassword({ currentPassword, newPassword });
	if (!res.ok) {
		const body = (await apiErrorBody(res)) as PasswordErrorBody;
		return passwordFailure(
			res,
			body,
			await apiErrorMessage(res, event.failures.changePassword, body),
			event
		);
	}
	forwardSetCookie(res, event.cookies);
	return responseJsonBody<{ ok: boolean; successMessage: string }>(res, {
		ok: true,
		successMessage: 'Password updated.'
	});
}

export async function logoutAction(event: LogoutEvent): Promise<never> {
	const res = await event.logout();
	forwardSetCookie(res, event.cookies);
	throw redirect(event.redirectTo, 303);
}

export async function magicLoginCallback(event: MagicLoginEvent): Promise<never> {
	const token = event.token ?? event.params?.token;
	const next = event.next ?? event.url?.searchParams.get('next') ?? null;

	if (!token) throw redirect(getReauthMagicRedirectPath(next, 'failed'), 303);

	const res = await event.magicLogin({ token });
	if (!res.ok) throw redirect(getReauthMagicRedirectPath(next, 'failed'), 303);

	forwardSetCookie(res, event.cookies);
	throw redirect(getReauthMagicRedirectPath(next, 'ok'), 303);
}
