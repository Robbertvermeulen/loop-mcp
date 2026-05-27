import { test, expect } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { buildMcpServer } from '@/mcp/server';

test('create_request tool returns a URL and pending status', async () => {
  const db = await createTestDb();
  const user = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const server = buildMcpServer({ db, user, publicBaseUrl: 'https://loop.app' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '0' }, { capabilities: {} });
  await client.connect(clientT);

  const result = await client.callTool({
    name: 'create_request',
    arguments: {
      title: 'Design feedback',
      context: 'briefing for future self',
      questions: [{ id: 'q1', type: 'text_short', prompt: 'name?' }],
    },
  });

  expect(result.isError).toBeFalsy();
  const content = result.content as Array<{ type: string; text: string }>;
  const text = content[0]?.text ?? '';
  const parsed = JSON.parse(text);
  expect(parsed.status).toBe('pending');
  expect(parsed.url).toMatch(/^https:\/\/loop\.app\/r\/[A-Za-z0-9_-]{43}$/);
});
