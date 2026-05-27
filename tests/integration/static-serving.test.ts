import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { buildApp } from '@/server';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SPA_DIST = resolve(import.meta.dir, '../../apps/client-form/dist');

function ensureFixtureSpa() {
  if (!existsSync(SPA_DIST)) {
    mkdirSync(SPA_DIST, { recursive: true });
  }
  writeFileSync(`${SPA_DIST}/index.html`, '<!doctype html><html><body>TEST_SPA</body></html>');
  const assetDir = `${SPA_DIST}/assets`;
  if (!existsSync(assetDir)) mkdirSync(assetDir, { recursive: true });
  writeFileSync(`${assetDir}/test.js`, 'console.log("ok")');
}

test('GET /r/:token serves the SPA index.html', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x' });
  const res = await app.request('/r/sometoken');
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('TEST_SPA');
  expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/);
});

test('GET /r/assets/test.js serves the asset', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x' });
  const res = await app.request('/r/assets/test.js');
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('console.log');
});

test('GET /r/ returns the SPA index.html', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x' });
  const res = await app.request('/r/');
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('TEST_SPA');
});
