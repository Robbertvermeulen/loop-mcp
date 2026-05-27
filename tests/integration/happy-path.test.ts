import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createApiToken } from '@/auth/tokens';
import { buildApp } from '@/server';

test('full e2e: create via MCP HTTP → answer via REST → pull via MCP HTTP', async () => {
  const testDb = await createTestDb();
  const user = await signupUser(testDb, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'Robbert' });
  const { plain } = await createApiToken(testDb, user.id, 'laptop');
  const app = buildApp({ db: testDb, publicBaseUrl: 'https://loop.app' });

  // 1. Claude creates a request via MCP
  const createRes = await app.request('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      authorization: `Bearer ${plain}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'create_request',
        arguments: {
          title: 'Homepage feedback',
          context: 'briefing',
          questions: [
            { id: 'color', type: 'single_choice', prompt: 'kleur?', options: ['rood', 'blauw'] },
          ],
        },
      },
    }),
  });
  expect(createRes.status).toBe(200);
  const createText = await createRes.text();
  let createBody: { result: { content: Array<{ text: string }> } };
  try {
    createBody = JSON.parse(createText);
  } catch {
    const dataLine = createText.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) throw new Error(`Unexpected create response: ${createText}`);
    createBody = JSON.parse(dataLine.slice(5).trim());
  }
  const toolText = createBody.result.content[0]?.text ?? '';
  const created = JSON.parse(toolText) as { url: string; slug: string };
  const token = created.url.split('/r/')[1] ?? '';
  expect(token).not.toBe('');

  // 2. Recipient GETs the public view
  const view = await app.request(`/api/r/${token}`);
  expect(view.status).toBe(200);
  expect(((await view.json()) as { displayName: string }).displayName).toBe('Robbert');

  // 3. Recipient autosaves a draft
  await app.request(`/api/r/${token}/draft`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ color: { value: 'rood' } }),
  });

  // 4. Recipient submits
  const submitRes = await app.request(`/api/r/${token}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ color: { value: 'rood' } }),
  });
  expect(submitRes.status).toBe(200);

  // 5. Claude pulls via MCP
  const pullRes = await app.request('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream',
      authorization: `Bearer ${plain}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_response', arguments: { ref: created.slug } },
    }),
  });
  const pullTextRaw = await pullRes.text();
  let pullBody: { result: { content: Array<{ text: string }> } };
  try {
    pullBody = JSON.parse(pullTextRaw);
  } catch {
    const dataLine = pullTextRaw.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) throw new Error(`Unexpected pull response: ${pullTextRaw}`);
    pullBody = JSON.parse(dataLine.slice(5).trim());
  }
  const pullText = pullBody.result.content[0]?.text ?? '';
  const pulled = JSON.parse(pullText);
  expect(pulled.status).toBe('pulled');
  expect(pulled.answers).toEqual({ color: { value: 'rood' } });

  // 6. After pull, recipient can no longer view
  const closed = await app.request(`/api/r/${token}`);
  expect(closed.status).toBe(410);
});
