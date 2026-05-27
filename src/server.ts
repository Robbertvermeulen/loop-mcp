import { Hono } from 'hono';
import { errorMiddleware } from './middleware/error';
import { buildPublicApi } from './api/public';
import { buildAppApi } from './api/app';
import { buildMcpHttpRoute } from './mcp/http';
import { db as prodDb, type DB } from './db/client';
import type { TestDB } from './db/test-db';
import { resolve } from 'path';
import { stat } from 'fs/promises';

export function buildApp(deps: { db: DB | TestDB; publicBaseUrl: string }) {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.route('/mcp', buildMcpHttpRoute({ db: deps.db, publicBaseUrl: deps.publicBaseUrl }));
  app.route('/api/app', buildAppApi(deps.db));
  app.route('/api/r', buildPublicApi(deps.db));
  const SPA_DIST = resolve(import.meta.dir, '../apps/client-form/dist');
  app.get('/r', (c) => c.redirect('/r/', 302));
  app.get('/r/*', async (c) => {
    const path = c.req.path.replace(/^\/r\/?/, '');
    return serveSpaPath(SPA_DIST, path);
  });
  return app;
}

async function serveSpaPath(spaDist: string, relative: string): Promise<Response> {
  const isAsset = /\.[a-z0-9]+$/i.test(relative);
  if (isAsset) {
    const filePath = resolve(spaDist, relative);
    try {
      const s = await stat(filePath);
      if (s.isFile()) {
        const file = Bun.file(filePath);
        const contentType = mimeFor(relative) ?? 'application/octet-stream';
        return new Response(file, { headers: { 'content-type': contentType } });
      }
    } catch {
      return new Response('Not found', { status: 404 });
    }
    return new Response('Not found', { status: 404 });
  }
  const indexPath = resolve(spaDist, 'index.html');
  try {
    const file = Bun.file(indexPath);
    return new Response(file, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch {
    return new Response('SPA not built', { status: 500 });
  }
}

function mimeFor(p: string): string | null {
  if (p.endsWith('.js') || p.endsWith('.mjs')) return 'text/javascript';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.ico')) return 'image/x-icon';
  if (p.endsWith('.map')) return 'application/json';
  if (p.endsWith('.json')) return 'application/json';
  return null;
}

if (import.meta.main) {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const app = buildApp({ db: prodDb, publicBaseUrl });
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`Loop listening on http://localhost:${port}`);
}
