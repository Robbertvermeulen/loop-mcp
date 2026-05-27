import { Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { authenticateBearer } from './auth';
import { buildMcpServer } from './server';

export function buildMcpHttpRoute(opts: { db: DB | TestDB; publicBaseUrl: string }) {
  const r = new Hono();

  r.post('/', async (c) => {
    const user = await authenticateBearer(opts.db, c.req.header('authorization'));
    const server = buildMcpServer({ db: opts.db, user, publicBaseUrl: opts.publicBaseUrl });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
      enableJsonResponse: true,      // return JSON instead of SSE for simple request/response
    });
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return r;
}
