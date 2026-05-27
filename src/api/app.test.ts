import { test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createTestDb } from '@/db/test-db';
import { buildAppApi } from './app';
import { errorMiddleware } from '@/middleware/error';

async function build() {
  const db = await createTestDb();
  const app = new Hono();
  app.onError(errorMiddleware);
  app.route('/api/app', buildAppApi(db));
  return app;
}

test('signup → login → me returns user; logout clears session', async () => {
  const app = await build();
  const signup = await app.request('/api/app/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' }),
  });
  expect(signup.status).toBe(200);
  const sessionCookie = signup.headers.get('set-cookie');
  expect(sessionCookie).toContain('loop_session=');

  const me = await app.request('/api/app/me', { headers: { Cookie: sessionCookie ?? '' } });
  expect(me.status).toBe(200);
  expect(((await me.json()) as { user: { email: string } }).user.email).toBe('a@b.c');

  const logout = await app.request('/api/app/logout', {
    method: 'POST',
    headers: { Cookie: sessionCookie ?? '' },
  });
  expect(logout.status).toBe(200);

  const me2 = await app.request('/api/app/me', { headers: { Cookie: sessionCookie ?? '' } });
  expect(me2.status).toBe(401);
});

test('login with valid credentials returns session cookie', async () => {
  const app = await build();
  await app.request('/api/app/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' }),
  });
  const res = await app.request('/api/app/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2hunter2' }),
  });
  expect(res.status).toBe(200);
  expect(res.headers.get('set-cookie')).toContain('loop_session=');
});

test('login with wrong password returns 401', async () => {
  const app = await build();
  await app.request('/api/app/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' }),
  });
  const res = await app.request('/api/app/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'wrong-password' }),
  });
  expect(res.status).toBe(401);
});

test('POST/GET/DELETE /api/app/tokens manages tokens for the logged-in user', async () => {
  const app = await build();
  const signup = await app.request('/api/app/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' }),
  });
  const cookie = signup.headers.get('set-cookie') ?? '';
  const create = await app.request('/api/app/tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ label: 'laptop' }),
  });
  expect(create.status).toBe(200);
  const created = (await create.json()) as { id: string; plain: string };
  expect(created.plain.startsWith('lp_')).toBe(true);

  const list = await app.request('/api/app/tokens', { headers: { Cookie: cookie } });
  expect(((await list.json()) as { tokens: unknown[] }).tokens).toHaveLength(1);

  const del = await app.request(`/api/app/tokens/${created.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie },
  });
  expect(del.status).toBe(200);
  const list2 = await app.request('/api/app/tokens', { headers: { Cookie: cookie } });
  expect(((await list2.json()) as { tokens: unknown[] }).tokens).toHaveLength(0);
});
