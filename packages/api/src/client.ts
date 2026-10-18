/**
 * Public surface re-export consumed by `@ak5/web` and `@ak5/admin` for type-safe
 * RPC. Only the package root is exported to frontend packages. The declaration
 * build still emits Hono's referenced route graph into `dist/`, but consumers
 * only import the public `WebApiType` / `AdminApiType` type surface and the
 * runtime entry is a guard stub.
 */
export type { WebApiType, AdminApiType } from './app';

export type { ItemDto } from './lib/items';
