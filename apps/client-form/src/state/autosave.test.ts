import { test, expect } from 'bun:test';
import { createAutosave } from './autosave';
import type { Answers } from '../types';

function tick(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

test('autosave debounces multiple rapid changes into one save', async () => {
  const calls: Answers[] = [];
  const save = async (a: Answers) => {
    calls.push(a);
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 50 });
  auto.schedule({ q1: 'a' });
  auto.schedule({ q1: 'ab' });
  auto.schedule({ q1: 'abc' });
  await tick(80);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual({ q1: 'abc' });
});

test('autosave waiting state reflects pending save', async () => {
  const save = async () => {
    await tick(40);
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 20 });
  expect(auto.status()).toBe('idle');
  auto.schedule({ q1: 'x' });
  expect(auto.status()).toBe('pending');
  await tick(30);
  expect(auto.status()).toBe('saving');
  await tick(50);
  expect(auto.status()).toBe('idle');
});

test('autosave retries on transient failure', async () => {
  let calls = 0;
  const save = async () => {
    calls += 1;
    if (calls < 3) throw new Error('transient');
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 10, retryMs: 20, maxRetries: 5 });
  auto.schedule({ q1: 'x' });
  await tick(200);
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(auto.status()).toBe('idle');
});

test('autosave goes to error status after max retries', async () => {
  const save = async () => {
    throw new Error('persistent');
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 10, retryMs: 10, maxRetries: 2 });
  auto.schedule({ q1: 'x' });
  await tick(150);
  expect(auto.status()).toBe('error');
});

test('flush() forces an immediate save (no debounce wait)', async () => {
  const calls: Answers[] = [];
  const save = async (a: Answers) => {
    calls.push(a);
  };
  const auto = createAutosave({ saveFn: save, debounceMs: 200 });
  auto.schedule({ q1: 'x' });
  await auto.flush();
  expect(calls).toEqual([{ q1: 'x' }]);
});
