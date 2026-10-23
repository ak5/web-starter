/**
 * Server-side helper that generates prefixed public IDs.
 *
 * Re-exports the cross-package `publicId` from `@ak5/shared` so api consumers
 * can import without crossing a package boundary in business logic.
 */
export { publicId, isPublicId, PUBLIC_ID_PREFIXES, type PublicIdEntity } from '@ak5/shared';
