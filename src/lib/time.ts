let mocked: number | null = null;

export function now(): number {
  return mocked ?? Date.now();
}

export function mockNow(ms: number | null): void {
  mocked = ms;
}
