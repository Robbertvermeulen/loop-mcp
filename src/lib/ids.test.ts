import { test, expect } from 'bun:test';
import { newUlid, newUrlSafeToken } from './ids';

test('newUlid returns a 26-char lexicographically-sortable ID', () => {
  const a = newUlid();
  const b = newUlid();
  expect(a).toHaveLength(26);
  expect(b).toHaveLength(26);
  expect(a < b || a === b).toBe(true);
});

test('newUrlSafeToken returns a 43-char URL-safe string (32 random bytes base64url)', () => {
  const t = newUrlSafeToken();
  expect(t).toHaveLength(43);
  expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
});

test('newUrlSafeToken produces different values each call', () => {
  const a = newUrlSafeToken();
  const b = newUrlSafeToken();
  expect(a).not.toBe(b);
});
