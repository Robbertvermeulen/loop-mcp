import { test, expect } from 'bun:test';
import { Hono } from 'hono';
import { errorMiddleware } from './error';
import { AppError } from '@/lib/errors';

test('errorMiddleware turns AppError into JSON with correct status', async () => {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.get('/boom', () => {
    throw new AppError('not_found', 'gone', 404, { x: 1 });
  });
  const res = await app.request('/boom');
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({
    error: { code: 'not_found', message: 'gone', details: { x: 1 } },
  });
});

test('errorMiddleware turns unknown errors into internal 500', async () => {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.get('/boom', () => {
    throw new Error('whoops');
  });
  const res = await app.request('/boom');
  expect(res.status).toBe(500);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBe('internal');
});
