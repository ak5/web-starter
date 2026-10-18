import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_API_URL: { public: true, schema: (input) => input ?? '' },
	JWT_SECRET: { schema: (input) => input },
	PUBLIC_COOKIE_ORIGIN: { schema: (input) => input }
});
