import { Hono } from 'hono';
import { errorMiddleware } from './middleware/error';

export function buildApp() {
  const app = new Hono();
  app.onError(errorMiddleware);
  app.get('/healthz', (c) => c.json({ ok: true }));
  return app;
}

if (import.meta.main) {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 3000);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`Loop listening on http://localhost:${port}`);
}
