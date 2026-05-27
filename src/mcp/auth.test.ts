import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createApiToken } from '@/auth/tokens';
import { authenticateBearer } from './auth';
import { AppError } from '@/lib/errors';

test('authenticateBearer resolves user for valid token', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { plain } = await createApiToken(db, u.id, 'laptop');
  const got = await authenticateBearer(db, `Bearer ${plain}`);
  expect(got.id).toBe(u.id);
});

test('authenticateBearer throws auth_failed for missing/invalid header', async () => {
  const db = await createTestDb();
  await expect(authenticateBearer(db, undefined)).rejects.toThrow(AppError);
  await expect(authenticateBearer(db, 'Bearer garbage')).rejects.toThrow(AppError);
  await expect(authenticateBearer(db, 'notbearer xyz')).rejects.toThrow(AppError);
});
