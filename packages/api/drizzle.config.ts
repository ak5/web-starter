import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL;
if (!url) {
	throw new Error('DATABASE_URL is required to run drizzle-kit (set in packages/api/.env)');
}

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema.ts',
	out: './drizzle',
	verbose: true,
	strict: true,
	dbCredentials: { url }
});
