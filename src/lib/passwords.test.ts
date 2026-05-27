import { test, expect } from 'bun:test';
import { hashPassword, verifyPassword } from './passwords';

test('hashPassword + verifyPassword round-trip', async () => {
  const hash = await hashPassword('correct horse battery staple');
  expect(hash).not.toBe('correct horse battery staple');
  expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  expect(await verifyPassword('wrong', hash)).toBe(false);
});
