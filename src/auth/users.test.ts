import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser, getUserByEmail, getUserById, verifyUserPassword } from './users';
import { AppError } from '@/lib/errors';

test('signupUser creates and returns a user', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  expect(u.id).toMatch(/^[0-9A-Z]{26}$/);
  expect(u.email).toBe('a@b.c');
  expect(u.displayName).toBe('A');
});

test('signupUser rejects duplicate emails', async () => {
  const db = await createTestDb();
  await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await expect(
    signupUser(db, { email: 'a@b.c', password: 'whatever12345', displayName: 'B' })
  ).rejects.toThrow(AppError);
});

test('signupUser rejects too-short passwords', async () => {
  const db = await createTestDb();
  await expect(
    signupUser(db, { email: 'a@b.c', password: '1234567', displayName: 'A' })
  ).rejects.toThrow(/password/i);
});

test('getUserByEmail returns the user or null', async () => {
  const db = await createTestDb();
  expect(await getUserByEmail(db, 'nope@x.com')).toBeNull();
  await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const u = await getUserByEmail(db, 'a@b.c');
  expect(u?.email).toBe('a@b.c');
});

test('verifyUserPassword returns user on success, null on failure', async () => {
  const db = await createTestDb();
  await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  expect(await verifyUserPassword(db, 'a@b.c', 'hunter2hunter2')).not.toBeNull();
  expect(await verifyUserPassword(db, 'a@b.c', 'wrong')).toBeNull();
  expect(await verifyUserPassword(db, 'nope@x.com', 'wrong')).toBeNull();
});
