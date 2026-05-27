import type { Context } from 'hono';
import { AppError } from '@/lib/errors';

export function errorMiddleware(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as 400 | 401 | 403 | 404 | 409 | 410 | 429 | 500);
  }
  console.error('[unhandled]', err);
  return c.json(
    { error: { code: 'internal', message: 'Internal server error', details: undefined } },
    500
  );
}
