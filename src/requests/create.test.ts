import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest, MAX_ACTIVE_REQUESTS_PER_USER } from './create';
import { AppError } from '@/lib/errors';

const q = (id: string) =>
  ({ id, type: 'text_short' as const, prompt: 'q' });

test('createRequest returns id, slug, url, pending status', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, {
    title: 'Design feedback voor homepage!',
    questions: [q('q1')],
    publicBaseUrl: 'https://loop.app',
  });
  expect(r.id).toMatch(/^[0-9A-Z]{26}$/);
  expect(r.slug).toBe('design-feedback-voor-homepage');
  expect(r.status).toBe('pending');
  expect(r.url).toMatch(/^https:\/\/loop\.app\/r\/[A-Za-z0-9_-]{43}$/);
});

test('createRequest auto-resolves slug collision with -2, -3', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const a = await createRequest(db, u.id, { title: 'Same Title', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const b = await createRequest(db, u.id, { title: 'Same Title', questions: [q('q1')], publicBaseUrl: 'http://x' });
  const c = await createRequest(db, u.id, { title: 'Same Title', questions: [q('q1')], publicBaseUrl: 'http://x' });
  expect(a.slug).toBe('same-title');
  expect(b.slug).toBe('same-title-2');
  expect(c.slug).toBe('same-title-3');
});

test('createRequest accepts explicit slug', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await createRequest(db, u.id, {
    title: 'Whatever',
    slug: 'my-custom',
    questions: [q('q1')],
    publicBaseUrl: 'http://x',
  });
  expect(r.slug).toBe('my-custom');
});

test('createRequest upserts project by name', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const a = await createRequest(db, u.id, {
    title: 'X',
    projectName: 'Acme',
    questions: [q('q1')],
    publicBaseUrl: 'http://x',
  });
  const b = await createRequest(db, u.id, {
    title: 'Y',
    projectName: 'Acme',
    questions: [q('q1')],
    publicBaseUrl: 'http://x',
  });
  expect(a.projectId).toBeDefined();
  expect(a.projectId).toBe(b.projectId);
});

test('createRequest rejects invalid Question shape', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await expect(
    createRequest(db, u.id, {
      title: 'X',
      // @ts-expect-error
      questions: [{ id: 'q1', type: 'unknown', prompt: 'q' }],
      publicBaseUrl: 'http://x',
    })
  ).rejects.toThrow(AppError);
});

test('createRequest enforces active-request quota', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  for (let i = 0; i < MAX_ACTIVE_REQUESTS_PER_USER; i += 1) {
    await createRequest(db, u.id, {
      title: `t${i}`,
      questions: [q('q1')],
      publicBaseUrl: 'http://x',
    });
  }
  await expect(
    createRequest(db, u.id, { title: 'one-too-many', questions: [q('q1')], publicBaseUrl: 'http://x' })
  ).rejects.toThrow(/quota/i);
});
