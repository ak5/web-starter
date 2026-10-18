import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';

export type Database = ReturnType<typeof db>;

export function db(databaseUrl: string) {
	const pool = new Pool({ connectionString: databaseUrl });
	return drizzle(pool, { schema });
}

export { schema };
