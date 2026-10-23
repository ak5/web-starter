import type { JwtPayload } from '@ak5/shared';

export type AuthDataEvent = {
	locals: {
		auth: JwtPayload | null;
	};
};

export function loadAuthData({ locals }: AuthDataEvent) {
	return { auth: locals.auth };
}
