/**
 * Re-export of the shared JWT helpers. Keeping a thin wrapper here lets api
 * code import from a single namespace and keeps imports stable if helpers
 * later move (e.g. into a separate auth module).
 */
export {
	signJwt,
	verifyJwt,
	shouldRefreshJwt,
	jwtCookie,
	clearJwtCookie,
	type IssueJwtInput,
	type JwtPayload,
	type JwtType
} from '@ak5/shared';
