import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL is optional here so `prisma generate` works on a fresh clone without a .env file.
// Commands that need a database (migrate, db) fail with Prisma's own error when it is missing.
const databaseUrl = process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
