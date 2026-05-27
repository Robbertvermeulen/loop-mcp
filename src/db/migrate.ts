import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:./loop.db';
const client = createClient({ url });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './migrations' });
console.log('Migrations applied.');
