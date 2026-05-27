import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from '@/requests/create';
import { submit } from '@/answers/submit';
import { pullResponse } from '@/requests/read';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';

test('pull after submit transitions exactly once; concurrent submit on pulled is rejected', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, {
    title: 't',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
    publicBaseUrl: 'http://x',
  });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';

  // Recipient submits
  await submit(db, token, { q1: 'one' });

  // Dev pulls (transitions submitted → pulled)
  const pulled = await pullResponse(db, u.id, r.id);
  expect(pulled?.status).toBe('pulled');

  // Now recipient tries to re-submit — must fail with already_pulled
  await expect(submit(db, token, { q1: 'two' })).rejects.toMatchObject({
    code: 'already_pulled',
  });

  // Second pull is idempotent and returns same answers
  const pulled2 = await pullResponse(db, u.id, r.id);
  expect(pulled2?.status).toBe('pulled');
  expect(pulled2?.finalAnswers).toEqual({ q1: 'one' });
});

test('concurrent submit during pull is rejected after pull wins', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, {
    title: 't',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
    publicBaseUrl: 'http://x',
  });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';

  // First submit so pullResponse has something to pull
  await submit(db, token, { q1: 'first' });

  // Race: pull (transitions to pulled) and a competing submit
  const [pullRes, submitRes] = await Promise.allSettled([
    pullResponse(db, u.id, r.id),
    submit(db, token, { q1: 'racer' }),
  ]);

  // Pull must always succeed.
  expect(pullRes.status).toBe('fulfilled');
  if (pullRes.status === 'fulfilled') {
    expect(pullRes.value?.status).toBe('pulled');
  }

  // The competing submit either succeeded (won the race before pull) OR was rejected with already_pulled.
  // Either is acceptable — what is NOT acceptable is silent overwrite, which the new guard prevents.
  if (submitRes.status === 'rejected') {
    expect((submitRes.reason as { code: string }).code).toBe('already_pulled');
  }

  // Final state: status='pulled'
  const final = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  expect(final[0]?.status).toBe('pulled');
});

test('two parallel pulls each get answers; only one performs the transition', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, {
    title: 't',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
    publicBaseUrl: 'http://x',
  });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await submit(db, token, { q1: 'answer' });

  const [a, b] = await Promise.all([
    pullResponse(db, u.id, r.id),
    pullResponse(db, u.id, r.id),
  ]);
  expect(a?.status).toBe('pulled');
  expect(b?.status).toBe('pulled');
  expect(a?.finalAnswers).toEqual({ q1: 'answer' });
  expect(b?.finalAnswers).toEqual({ q1: 'answer' });
});
