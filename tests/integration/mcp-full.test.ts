import { test, expect } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { buildMcpServer } from '@/mcp/server';
import { submit } from '@/answers/submit';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';

async function bootMcp() {
  const db = await createTestDb();
  const user = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const server = buildMcpServer({ db, user, publicBaseUrl: 'https://loop.app' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '0' }, { capabilities: {} });
  await client.connect(clientT);
  return { db, user, client };
}

async function callJson<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const r = await client.callTool({ name, arguments: args });
  const content = r.content as Array<{ text: string }>;
  if (r.isError) throw new Error(content[0]?.text ?? 'unknown error');
  return JSON.parse(content[0]?.text ?? '{}') as T;
}

test('list/get/peek/cancel full lifecycle', async () => {
  const { db, client } = await bootMcp();

  // 1. Create
  const created = await callJson<{ id: string; slug: string }>(client, 'create_request', {
    title: 'Design',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'name?' }],
  });

  // 2. List shows it as pending
  const pending = await callJson<Array<{ slug: string }>>(client, 'list_requests', {});
  expect(pending).toHaveLength(1);
  expect(pending[0]?.slug).toBe('design');

  // 3. Peek without pulling: still pending, no answers
  const peek1 = await callJson<{ status: string; answers?: unknown }>(client, 'peek_response', { ref: 'design' });
  expect(peek1.status).toBe('pending');
  expect(peek1.answers).toBeUndefined();

  // 4. Simulate recipient submit
  const tokenRows = await db.select().from(requests).where(eq(requests.id, created.id)).limit(1);
  const token = tokenRows[0]?.token ?? '';
  await submit(db, token, { q1: 'hi from recipient' });

  // 5. List now shows submitted
  const afterSubmit = await callJson<Array<{ status: string }>>(client, 'list_requests', {});
  expect(afterSubmit[0]?.status).toBe('submitted');

  // 6. Get marks pulled and returns answers
  const got = await callJson<{ status: string; answers: Record<string, unknown> }>(client, 'get_response', { ref: 'design' });
  expect(got.status).toBe('pulled');
  expect(got.answers).toEqual({ q1: 'hi from recipient' });

  // 7. After pull, peek still works idempotently
  const peek2 = await callJson<{ status: string }>(client, 'peek_response', { ref: 'design' });
  expect(peek2.status).toBe('pulled');

  // 8. Cancel a second one
  const second = await callJson<{ slug: string }>(client, 'create_request', {
    title: 'wrong-request',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
  });
  await callJson(client, 'cancel_request', { ref: second.slug });
  const all = await callJson<Array<{ slug: string; status: string }>>(client, 'list_requests', { status: 'any' });
  const cancelled = all.find((r) => r.slug === 'wrong-request');
  expect(cancelled?.status).toBe('cancelled');
});

test('get_response with no submission throws not_yet_submitted', async () => {
  const { client } = await bootMcp();
  await callJson(client, 'create_request', {
    title: 'q',
    questions: [{ id: 'q1', type: 'text_short', prompt: 'q?' }],
  });
  const r = await client.callTool({ name: 'get_response', arguments: { ref: 'q' } });
  expect(r.isError).toBe(true);
  const content = r.content as Array<{ text: string }>;
  const payload = JSON.parse(content[0]?.text ?? '{}');
  expect(payload.error.code).toBe('not_yet_submitted');
});
