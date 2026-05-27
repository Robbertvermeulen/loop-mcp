import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from '@/requests/create';
import { upsertDraft } from './draft';
import { getRequestByRef } from '@/requests/read';
import { AppError } from '@/lib/errors';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';

const q = (id: string) => ({ id, type: 'text_short' as const, prompt: 'q' });

test('upsertDraft writes partial draftAnswers on a pending request', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1'), q('q2')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await upsertDraft(db, token, { q1: 'hi' });
  const loaded = await getRequestByRef(db, u.id, r.id);
  expect(loaded?.draftAnswers).toEqual({ q1: 'hi' });
});

test('upsertDraft replaces (not merges) draftAnswers', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1'), q('q2')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await upsertDraft(db, token, { q1: 'a' });
  await upsertDraft(db, token, { q2: 'b' });
  const loaded = await getRequestByRef(db, u.id, r.id);
  expect(loaded?.draftAnswers).toEqual({ q2: 'b' });
});

test('upsertDraft rejects malformed answers for a known question', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await expect(upsertDraft(db, token, { q1: { wrong: 'shape' } as unknown as string })).rejects.toThrow(AppError);
});

test('upsertDraft throws for cancelled/pulled tokens', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, { title: 't', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await db.update(requests).set({ status: 'cancelled', cancelledAt: 1 }).where(eq(requests.id, r.id));
  await expect(upsertDraft(db, token, { q1: 'x' })).rejects.toThrow(/cancel/i);
  await db.update(requests).set({ status: 'pulled', pulledAt: 1, cancelledAt: null }).where(eq(requests.id, r.id));
  await expect(upsertDraft(db, token, { q1: 'x' })).rejects.toThrow(/pulled/i);
});

test('upsertDraft throws not_found for unknown token', async () => {
  const db = await createTestDb();
  await expect(upsertDraft(db, 'nonexistent', { q1: 'x' })).rejects.toThrow(/not.*found/i);
});
