import { test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createRequest } from '@/requests/create';
import { buildPublicApi } from './public';
import { errorMiddleware } from '@/middleware/error';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';

const q = (id: string) => ({ id, type: 'text_short' as const, prompt: 'q' });

async function setup() {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'Robbert' });
  const r = await createRequest(db, u.id, {
    title: 'Hi',
    intro: 'intro text',
    questions: [q('q1')],
    publicBaseUrl: 'http://x',
  });
  const tokenRows = await db.select().from(requests).where(eq(requests.id, r.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  const app = new Hono();
  app.onError(errorMiddleware);
  app.route('/api/r', buildPublicApi(db));
  return { app, token };
}

test('GET /api/r/:token returns the public view', async () => {
  const { app, token } = await setup();
  const res = await app.request(`/api/r/${token}`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.title).toBe('Hi');
  expect(body.intro).toBe('intro text');
  expect(body.displayName).toBe('Robbert');
  expect((body.questions as unknown[]).length).toBe(1);
  expect(body.context).toBeUndefined();
  expect(body.token).toBeUndefined();
});

test('GET /api/r/:token returns 404 for unknown token', async () => {
  const { app } = await setup();
  const res = await app.request('/api/r/no-such-token');
  expect(res.status).toBe(404);
});

test('PUT /api/r/:token/draft saves a draft', async () => {
  const { app, token } = await setup();
  const res = await app.request(`/api/r/${token}/draft`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q1: 'partial' }),
  });
  expect(res.status).toBe(200);
  const view = (await (await app.request(`/api/r/${token}`)).json()) as Record<string, unknown>;
  expect(view.draftAnswers).toEqual({ q1: 'partial' });
});

test('POST /api/r/:token/submit submits and changes status', async () => {
  const { app, token } = await setup();
  const res = await app.request(`/api/r/${token}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q1: 'final' }),
  });
  expect(res.status).toBe(200);
  const view = (await (await app.request(`/api/r/${token}`)).json()) as Record<string, unknown>;
  expect(view.status).toBe('submitted');
});
