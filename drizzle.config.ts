import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'libsql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./loop.db',
  },
} satisfies Config;
