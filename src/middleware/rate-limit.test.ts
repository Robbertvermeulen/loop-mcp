import { test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { writeRateLimit, _resetRateLimitForTests } from './rate-limit';
import { errorMiddleware } from './error';

beforeEach(() => _resetRateLimitForTests());

test('writeRateLimit blocks after threshold', async () => {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.use('*', writeRateLimit({ limit: 3, windowMs: 60_000 }));
  app.post('/x', (c) => c.json({ ok: true }));

  const ip = { 'x-forwarded-for': '1.2.3.4' };
  for (let i = 0; i < 3; i += 1) {
    const r = await app.request('/x', { method: 'POST', headers: ip });
    expect(r.status).toBe(200);
  }
  const blocked = await app.request('/x', { method: 'POST', headers: ip });
  expect(blocked.status).toBe(429);
});

test('writeRateLimit isolates per IP', async () => {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.use('*', writeRateLimit({ limit: 2, windowMs: 60_000 }));
  app.post('/x', (c) => c.json({ ok: true }));

  await app.request('/x', { method: 'POST', headers: { 'x-forwarded-for': '1.1.1.1' } });
  await app.request('/x', { method: 'POST', headers: { 'x-forwarded-for': '1.1.1.1' } });
  const blocked = await app.request('/x', { method: 'POST', headers: { 'x-forwarded-for': '1.1.1.1' } });
  expect(blocked.status).toBe(429);

  const other = await app.request('/x', { method: 'POST', headers: { 'x-forwarded-for': '2.2.2.2' } });
  expect(other.status).toBe(200);
});
