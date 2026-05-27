import { test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createApiToken } from '@/auth/tokens';
import { buildMcpHttpRoute } from './http';
import { errorMiddleware } from '@/middleware/error';

async function setup() {
  const db = await createTestDb();
  const user = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { plain } = await createApiToken(db, user.id, 'laptop');
  const app = new Hono();
  app.onError(errorMiddleware);
  app.route('/mcp', buildMcpHttpRoute({ db, publicBaseUrl: 'https://loop.app' }));
  return { app, plain };
}

test('POST /mcp without Bearer returns 401', async () => {
  const { app } = await setup();
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  expect(res.status).toBe(401);
});

test('POST /mcp with valid Bearer returns tools list', async () => {
  const { app, plain } = await setup();
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      authorization: `Bearer ${plain}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  expect(res.status).toBe(200);
  // Response could be plain JSON or SSE format
  const text = await res.text();
  // Allow either parsing approach
  let body: { result?: { tools?: Array<{ name: string }> } };
  try {
    body = JSON.parse(text);
  } catch {
    // SSE format — extract the data: line
    const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
    if (!dataLine) throw new Error(`Could not parse response: ${text.slice(0, 200)}`);
    body = JSON.parse(dataLine.slice(5).trim());
  }
  const names = body.result?.tools?.map((t) => t.name) ?? [];
  expect(names).toContain('create_request');
  expect(names).toContain('get_response');
});
