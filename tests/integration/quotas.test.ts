import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createApiToken } from '@/auth/tokens';
import { buildApp } from '@/server';
import { MAX_ACTIVE_REQUESTS_PER_USER } from '@/requests/create';

test('MCP create_request returns quota_exceeded after the cap', async () => {
  const testDb = await createTestDb();
  const user = await signupUser(testDb, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const { plain } = await createApiToken(testDb, user.id, 't');
  const app = buildApp({ db: testDb, publicBaseUrl: 'http://x' });

  async function callMcp(id: number, args: Record<string, unknown>) {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream',
        authorization: `Bearer ${plain}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: 'create_request', arguments: args },
      }),
    });
    const text = await res.text();
    let body: { result: { isError?: boolean; content: Array<{ text: string }> } };
    try {
      body = JSON.parse(text);
    } catch {
      const dataLine = text.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) throw new Error(`Bad response: ${text.slice(0, 200)}`);
      body = JSON.parse(dataLine.slice(5).trim());
    }
    return body.result;
  }

  for (let i = 0; i < MAX_ACTIVE_REQUESTS_PER_USER; i += 1) {
    const result = await callMcp(i + 1, {
      title: `r-${i}`,
      questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
    });
    expect(result.isError).toBeFalsy();
  }

  const overflow = await callMcp(999, {
    title: 'too-many',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
  });
  expect(overflow.isError).toBe(true);
  const errPayload = JSON.parse(overflow.content[0]?.text ?? '{}');
  expect(errPayload.error.code).toBe('quota_exceeded');
}, 60_000);
