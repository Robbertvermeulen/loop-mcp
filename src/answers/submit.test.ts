import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from '@/requests/create';
import { submit } from './submit';
import { getRequestByRef } from '@/requests/read';
import { AppError } from '@/lib/errors';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';

const q = (id: string, required = true) => ({ id, type: 'text_short' as const, prompt: 'q', required });

test('submit sets status=submitted, finalAnswers, submittedAt', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await submit(db, token, { q1: 'final answer' });
  const loaded = await getRequestByRef(db, u.id, r.id);
  expect(loaded?.status).toBe('submitted');
  expect(loaded?.finalAnswers).toEqual({ q1: 'final answer' });
  expect(loaded?.submittedAt ?? 0).toBeGreaterThan(0);
});

test('submit re-submission overwrites finalAnswers and updates submittedAt', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await submit(db, token, { q1: 'one' });
  const first = await getRequestByRef(db, u.id, r.id);
  await new Promise((r) => setTimeout(r, 5));
  await submit(db, token, { q1: 'two' });
  const second = await getRequestByRef(db, u.id, r.id);
  expect(second?.finalAnswers).toEqual({ q1: 'two' });
  expect(second?.submittedAt ?? 0).toBeGreaterThanOrEqual(first?.submittedAt ?? 0);
});

test('submit rejects missing required answers', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1', true), q('q2', true)], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await expect(submit(db, token, { q1: 'only' })).rejects.toThrow(/missing/i);
});

test('submit fails on already-pulled', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await db.update(requests).set({ status: 'pulled', pulledAt: 1 }).where(eq(requests.id, r.id));
  await expect(submit(db, token, { q1: 'x' })).rejects.toThrow(/pulled/i);
});

test('submit fails on cancelled', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await db.update(requests).set({ status: 'cancelled', cancelledAt: 1 }).where(eq(requests.id, r.id));
  await expect(submit(db, token, { q1: 'x' })).rejects.toThrow(/cancel/i);
});
