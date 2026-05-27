import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from './create';
import { cancelRequest } from './cancel';
import { getRequestByRef } from './read';
import { AppError } from '@/lib/errors';

const q = (id: string) => ({ id, type: 'text_short' as const, prompt: 'q' });

test('cancelRequest sets status=cancelled and cancelledAt', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await cancelRequest(db, u.id, r.id);
  const loaded = await getRequestByRef(db, u.id, r.id);
  expect(loaded?.status).toBe('cancelled');
  expect(loaded?.cancelledAt ?? 0).toBeGreaterThan(0);
});

test('cancelRequest is idempotent on already-cancelled', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await cancelRequest(db, u.id, r.id);
  await cancelRequest(db, u.id, r.id);
});

test('cancelRequest throws not_found for unknown ref', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await expect(cancelRequest(db, u.id, 'nope')).rejects.toThrow(AppError);
});

test('cancelRequest throws conflict if already pulled', async () => {
  const db = await createTestDb();
  const { requests } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await db.update(requests).set({ status: 'pulled', pulledAt: 1 }).where(eq(requests.id, r.id));
  await expect(cancelRequest(db, u.id, r.id)).rejects.toThrow(/already pulled|conflict/i);
});
