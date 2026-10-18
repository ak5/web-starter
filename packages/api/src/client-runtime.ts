/**
 * Tiny runtime stub for `@ak5/api`. Consumers only ever read types from this
 * package, but Node's ESM resolver insists on a real .js entry. Importing the
 * package at runtime is a programming error and throws.
 */
export const __noRuntime = () => {
	throw new Error('@ak5/api is type-only — import the worker via wrangler, not Node');
};
