import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from './create';
import { listRequests } from './list';

const q = (id: string) => ({ id, type: 'text_short' as const, prompt: 'q' });

test('listRequests returns pending requests with summary fields', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await createRequest(db, u.id, { title: 'first', questions: [q('q1'), q('q2')], publicBaseUrl: 'http://x' });
  const list = await listRequests(db, u.id, { status: ['pending'] });
  expect(list).toHaveLength(1);
  expect(list[0]?.title).toBe('first');
  expect(list[0]?.status).toBe('pending');
  expect(list[0]?.totalQuestions).toBe(2);
  expect(list[0]?.answerCount).toBe(0);
  expect(list[0]?.contextExcerpt).toBeUndefined();
  expect((list[0] as unknown as Record<string, unknown>).token).toBeUndefined();
});

test('listRequests returns contextExcerpt (first 200 chars)', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const long = 'word '.repeat(80);
  await createRequest(db, u.id, { title: 't', context: long, questions: [q('q1')], publicBaseUrl: 'http://x' });
  const list = await listRequests(db, u.id, { status: ['pending'] });
  expect(list[0]?.contextExcerpt?.length).toBeLessThanOrEqual(200);
  expect(list[0]?.contextExcerpt).toBe(long.slice(0, 200));
});

test('listRequests filters by projectName', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await createRequest(db, u.id, { title: 'a', projectName: 'P1', questions: [q('q1')], publicBaseUrl: 'http://x' });
  await createRequest(db, u.id, { title: 'b', projectName: 'P2', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const list = await listRequests(db, u.id, { projectName: 'P1' });
  expect(list).toHaveLength(1);
  expect(list[0]?.title).toBe('a');
});

test('listRequests applies default status filter pending,submitted', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await createRequest(db, u.id, { title: 'x', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const list = await listRequests(db, u.id, {});
  expect(list).toHaveLength(1);
});

test('listRequests is scoped to the user', async () => {
  const db = await createTestDb();
  const a = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const b = await signupUser(db, { email: 'b@b.c', password: 'hunter2hunter2', displayName: 'B' });
  await createRequest(db, a.id, { title: 'a-req', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const list = await listRequests(db, b.id, {});
  expect(list).toHaveLength(0);
});
