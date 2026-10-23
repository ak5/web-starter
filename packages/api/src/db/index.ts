import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export type Database = ReturnType<typeof db>;

export function db(binding: D1Database) {
	return drizzle(binding, { schema });
}

export { schema };
