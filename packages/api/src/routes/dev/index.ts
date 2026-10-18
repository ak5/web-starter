import { Hono } from 'hono';
import { dbBranchRoutes } from './db-branches';
import type { AppContext } from '../../types';

// ---------------------------------------------------------------------------
// /dev/* — collaborator tooling, intentionally unauthenticated.
// ---------------------------------------------------------------------------
// Each route under this namespace is self-protected by its own capability
// model (typically "possession of a high-entropy identifier is authorization")
// and MUST bound blast radius to dev-only resources. See
// `packages/api/src/routes/dev/db-branches.ts` for the canonical pattern:
// resolve the identifier server-side, then apply a resource-level guard
// (e.g. `isProtectedBranch`) that refuses anything production-adjacent.
//
// These routes run on the prod API worker even though they operate on dev
// resources, because the Neon account API key only lives on prod. Do NOT
// "block /dev/* in prod" — that would defeat the whole feature.
// ---------------------------------------------------------------------------

export const devRoutes = new Hono<AppContext>().route('/db-branches', dbBranchRoutes);
