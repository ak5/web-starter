import { z } from 'zod';

/**
 * Validation for the example `items` resource. `data` is a free-form JSON
 * object stored verbatim in a `jsonb` column — the API does not constrain its
 * shape, so swap this for your real domain schema when you replace `items`.
 */
export const itemDataSchema = z.record(z.string(), z.unknown());

export const itemCreateSchema = z.object({ data: itemDataSchema });
export const itemUpdateSchema = z.object({ data: itemDataSchema });

export type ItemCreate = z.infer<typeof itemCreateSchema>;
export type ItemUpdate = z.infer<typeof itemUpdateSchema>;
