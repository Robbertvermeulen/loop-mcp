import { test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createSession } from '@/auth/sessions';
import { cookieAuth, SESSION_COOKIE } from './cookie-auth';
import type { User } from '@/db/schema';

test('cookieAuth attaches user to context for valid cookie', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { id: sid } = await createSession(db, u.id);
  const app = new Hono<{ Variables: { user?: User } }>();
  app.use('*', cookieAuth(db));
  app.get('/me', (c) => c.json({ id: c.get('user')?.id ?? null }));
  const res = await app.request('/me', { headers: { Cookie: `${SESSION_COOKIE}=${sid}` } });
  expect(await res.json()).toEqual({ id: u.id });
});

test('cookieAuth leaves user undefined for missing/invalid cookies', async () => {
  const db = await createTestDb();
  const app = new Hono<{ Variables: { user?: User } }>();
  app.use('*', cookieAuth(db));
  app.get('/me', (c) => c.json({ id: c.get('user')?.id ?? null }));
  expect(await (await app.request('/me')).json()).toEqual({ id: null });
  expect(
    await (await app.request('/me', { headers: { Cookie: `${SESSION_COOKIE}=garbage` } })).json()
  ).toEqual({ id: null });
});
