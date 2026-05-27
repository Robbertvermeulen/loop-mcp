import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { users } from '@/db/schema';

test('createTestDb returns a usable drizzle db with all tables', async () => {
  const db = await createTestDb();
  const inserted = await db
    .insert(users)
    .values({
      id: 'u_test',
      email: 'a@b.c',
      passwordHash: 'x',
      displayName: 'A',
      createdAt: 0,
    })
    .returning();
  expect(inserted[0]?.id).toBe('u_test');
});
