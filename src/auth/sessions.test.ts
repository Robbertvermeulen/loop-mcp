import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from './users';
import { createSession, getSessionUser, deleteSession, SESSION_TTL_MS } from './sessions';
import { mockNow } from '@/lib/time';

test('createSession returns a session id and getSessionUser resolves', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { id } = await createSession(db, u.id);
  expect(id).toHaveLength(43);
  const found = await getSessionUser(db, id);
  expect(found?.id).toBe(u.id);
});

test('getSessionUser returns null for expired sessions', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  mockNow(1_000_000_000_000);
  const { id } = await createSession(db, u.id);
  mockNow(1_000_000_000_000 + SESSION_TTL_MS + 1);
  const found = await getSessionUser(db, id);
  expect(found).toBeNull();
  mockNow(null);
});

test('deleteSession removes the row', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { id } = await createSession(db, u.id);
  await deleteSession(db, id);
  expect(await getSessionUser(db, id)).toBeNull();
});

test('getSessionUser returns null for unknown session id', async () => {
  const db = await createTestDb();
  expect(await getSessionUser(db, 'no-such-session')).toBeNull();
});
