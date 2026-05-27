import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from './create';
import {
  getRequestByRef,
  getRequestByToken,
  peekResponse,
  pullResponse,
} from './read';
import { AppError } from '@/lib/errors';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';

const q = (id: string) => ({ id, type: 'text_short' as const, prompt: 'q' });

test('getRequestByRef resolves by id or slug, scoped to user', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const created = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const byId = await getRequestByRef(db, u.id, created.id);
  const bySlug = await getRequestByRef(db, u.id, created.slug);
  expect(byId?.id).toBe(created.id);
  expect(bySlug?.id).toBe(created.id);
});

test('getRequestByRef returns null for other user', async () => {
  const db = await createTestDb();
  const a = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const b = await signupUser(db, { email: 'b@b.c', password: 'hunter2hunter2', displayName: 'B' });
  const r = await createRequest(db, a.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  expect(await getRequestByRef(db, b.id, r.id)).toBeNull();
});

test('peekResponse never mutates status', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await db.update(requests).set({ status: 'submitted', submittedAt: 1, finalAnswers: '{"q1":"ans"}' }).where(eq(requests.id, r.id));
  const p1 = await peekResponse(db, u.id, r.id);
  const p2 = await peekResponse(db, u.id, r.id);
  expect(p1?.status).toBe('submitted');
  expect(p2?.status).toBe('submitted');
  expect(p1?.finalAnswers).toEqual({ q1: 'ans' });
});

test('pullResponse transitions submitted → pulled atomically', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await db.update(requests).set({ status: 'submitted', submittedAt: 1, finalAnswers: '{"q1":"ans"}' }).where(eq(requests.id, r.id));
  const first = await pullResponse(db, u.id, r.id);
  expect(first?.status).toBe('pulled');
  expect(first?.finalAnswers).toEqual({ q1: 'ans' });
  const second = await pullResponse(db, u.id, r.id);
  expect(second?.status).toBe('pulled');
  expect(second?.finalAnswers).toEqual({ q1: 'ans' });
});

test('pullResponse throws not_yet_submitted when status is pending', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await expect(pullResponse(db, u.id, r.id)).rejects.toThrow(AppError);
});

test('pullResponse throws cancelled when status is cancelled', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await db.update(requests).set({ status: 'cancelled', cancelledAt: 1 }).where(eq(requests.id, r.id));
  await expect(pullResponse(db, u.id, r.id)).rejects.toThrow(/cancel/i);
});

test('getRequestByToken returns the request irrespective of user', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  const byToken = await getRequestByToken(db, token);
  expect(byToken?.id).toBe(r.id);
});
