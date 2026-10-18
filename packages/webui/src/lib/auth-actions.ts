import { fail, redirect, type Cookies } from '@sveltejs/kit';

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
	cookies: Cookies;
	request: Request;
};

export type ForgotPasswordEvent = {
	forgotPassword: (input: ForgotPasswordInput) => Promise<ResponseLike>;
	request: Request;
};

export type LoginEvent = {
	cookies: Cookies;
	failureIncludesEmail?: boolean;
	login: (input: LoginInput) => Promise<ResponseLike>;
	request: Request;
	successRedirect: string;
	url?: URL;
};

export type LogoutEvent = {
	cookies: Cookies;
	logout: (input?: LogoutInput) => Promise<ResponseLike>;
	redirectTo: string;
};

export type MagicLoginEvent = {
	cookies: Cookies;
	magicLogin: (input: MagicLoginInput) => Promise<ResponseLike>;
	next?: string | null;
	params?: { token?: string };
	token?: string;
	url?: URL;
};

export type AccountPasswordEvent = {
	acceptInvite: (input: AcceptInvitePasswordInput) => Promise<ResponseLike>;
	changePassword: (input: ChangePasswordInput) => Promise<ResponseLike>;
	cookies: Cookies;
	locals: { auth?: AuthState | null };
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
	locals: { auth?: AuthState | null };
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
	if (!source.locals.auth && !data.resetToken) throw redirect(303, unauthenticatedRedirect);
	return data;
}

function passwordFailure(
	res: ResponseLike,
	body: PasswordErrorBody,
	error: string,
	event: AccountPasswordEvent,
	token?: string
) {
	return fail(res.status, {
		error,
		...(event.includeFailureCode ? { code: body.code } : {}),
		...(event.includeResetTokenOnFailure && token !== undefined ? { token } : {})
	});
}

export async function acceptInviteAction(event: AcceptInviteEvent) {
	const data = await event.request.formData();
	const token = String(data.get('token') ?? '');
	const password = String(data.get('password') ?? '');
	const password2 = String(data.get('password2') ?? '');

	const res = await event.acceptInvite({ token, password, passwordConfirm: password2 });
	if (!res.ok) {
		return fail(res.status, {
			error: await apiErrorMessage(res, 'Could not accept invite'),
			token
		});
	}

	const body = await responseJsonBody<{ redirectTo: string }>(res, { redirectTo: '/' });
	forwardSetCookie(res, event.cookies);
	throw redirect(303, body.redirectTo);
}

export async function forgotPasswordAction(event: ForgotPasswordEvent): Promise<unknown> {
	const data = await event.request.formData();
	const email = String(data.get('email') ?? '');
	const res = await event.forgotPassword({ email });
	return responseJsonBody(res, {});
}

export async function loginAction(event: LoginEvent) {
	const data = await event.request.formData();
	const email = String(data.get('email') ?? '');
	const password = String(data.get('password') ?? '');

	const res = await event.login({ email, password });
	if (!res.ok) {
		const body = (await apiErrorBody(res)) as { error?: string };
		return fail(401, {
			error: errorMessage(body.error, 'Invalid credentials'),
			...(event.failureIncludesEmail ? { email } : {})
		});
	}

	forwardSetCookie(res, event.cookies);
	throw redirect(
		303,
		getSafeLocalRedirectPath(event.url?.searchParams.get('next') ?? null, event.successRedirect) ??
			event.successRedirect
	);
}

export async function accountPasswordAction(event: AccountPasswordEvent): Promise<unknown> {
	const data = await event.request.formData();
	const token = String(data.get('token') ?? '');
	const newPassword = String(data.get('newPassword') ?? '');
	const password2 = String(data.get('password2') ?? '');

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
		throw redirect(303, body.redirectTo);
	}

	if (!event.locals.auth) {
		throw redirect(303, event.unauthenticatedRedirect ?? '/login');
	}

	if (!event.locals.auth.hasPassword) {
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
		return responseJsonBody(res, {});
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
	return responseJsonBody(res, {});
}

export async function logoutAction(event: LogoutEvent): Promise<never> {
	const res = await event.logout();
	forwardSetCookie(res, event.cookies);
	throw redirect(303, event.redirectTo);
}

export async function magicLoginCallback(event: MagicLoginEvent): Promise<never> {
	const token = event.token ?? event.params?.token;
	const next = event.next ?? event.url?.searchParams.get('next') ?? null;

	if (!token) throw redirect(303, getReauthMagicRedirectPath(next, 'failed'));

	const res = await event.magicLogin({ token });
	if (!res.ok) throw redirect(303, getReauthMagicRedirectPath(next, 'failed'));

	forwardSetCookie(res, event.cookies);
	throw redirect(303, getReauthMagicRedirectPath(next, 'ok'));
}
