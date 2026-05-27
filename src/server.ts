import { Hono } from 'hono';
import { errorMiddleware } from './middleware/error';
import { buildPublicApi } from './api/public';
import { buildAppApi } from './api/app';
import { buildMcpHttpRoute } from './mcp/http';
import { db as prodDb, type DB } from './db/client';
import type { TestDB } from './db/test-db';

export function buildApp(deps: { db: DB | TestDB; publicBaseUrl: string }) {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.route('/mcp', buildMcpHttpRoute({ db: deps.db, publicBaseUrl: deps.publicBaseUrl }));
  app.route('/api/app', buildAppApi(deps.db));
  app.route('/api/r', buildPublicApi(deps.db));
  return app;
}

if (import.meta.main) {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const app = buildApp({ db: prodDb, publicBaseUrl });
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`Loop listening on http://localhost:${port}`);
}
