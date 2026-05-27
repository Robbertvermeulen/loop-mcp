import { test, expect } from 'bun:test';
import { slugifyTitle, resolveSlugCollision } from './slugify';

test('slugifyTitle lowercases, replaces spaces and special chars', () => {
  expect(slugifyTitle('Design feedback voor homepage!')).toBe('design-feedback-voor-homepage');
  expect(slugifyTitle('  Café — naïve  ')).toBe('cafe-naive');
  expect(slugifyTitle('')).toBe('untitled');
  expect(slugifyTitle('!!!')).toBe('untitled');
});

test('slugifyTitle truncates to 50 chars', () => {
  const long = 'a'.repeat(80);
  expect(slugifyTitle(long).length).toBeLessThanOrEqual(50);
});

test('resolveSlugCollision appends -2, -3 ... when taken', () => {
  const taken = new Set(['my-slug', 'my-slug-2']);
  expect(resolveSlugCollision('my-slug', (s) => taken.has(s))).toBe('my-slug-3');
  expect(resolveSlugCollision('fresh', (s) => taken.has(s))).toBe('fresh');
});
