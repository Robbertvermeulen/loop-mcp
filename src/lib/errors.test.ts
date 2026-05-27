import { test, expect } from 'bun:test';
import { AppError, type ErrorCode } from './errors';

test('AppError carries code, message, status, details', () => {
  const err = new AppError('not_found', 'Request not found', 404, { id: 'r_1' });
  expect(err.code).toBe('not_found');
  expect(err.status).toBe(404);
  expect(err.details).toEqual({ id: 'r_1' });
  expect(err.message).toBe('Request not found');
});

test('AppError.toJSON shapes for client', () => {
  const err = new AppError('auth_failed', 'Bad token', 401);
  expect(err.toJSON()).toEqual({
    error: { code: 'auth_failed', message: 'Bad token', details: undefined },
  });
});
