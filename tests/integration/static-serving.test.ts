import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { buildApp } from '@/server';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';

// Use a dedicated temp directory so we never overwrite the real dist build.
const FIXTURE_DIR = resolve(tmpdir(), 'loop-spa-fixture-test');

function ensureFixtureSpa() {
  if (existsSync(FIXTURE_DIR)) {
    rmSync(FIXTURE_DIR, { recursive: true });
  }
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(`${FIXTURE_DIR}/index.html`, '<!doctype html><html><body>TEST_SPA</body></html>');
  const assetDir = `${FIXTURE_DIR}/assets`;
  mkdirSync(assetDir, { recursive: true });
  writeFileSync(`${assetDir}/test.js`, 'console.log("ok")');
}

test('GET /r/:token serves the SPA index.html', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x', spaDistPath: FIXTURE_DIR });
  const res = await app.request('/r/sometoken');
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('TEST_SPA');
  expect(res.headers.get('content-type') ?? '').toMatch(/text\/html/);
});

test('GET /r/assets/test.js serves the asset', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x', spaDistPath: FIXTURE_DIR });
  const res = await app.request('/r/assets/test.js');
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain('console.log');
});

test('GET /r/ returns the SPA index.html', async () => {
  ensureFixtureSpa();
  const db = await createTestDb();
  const app = buildApp({ db, publicBaseUrl: 'http://x', spaDistPath: FIXTURE_DIR });
  const res = await app.request('/r/');
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('TEST_SPA');
});
