import { Hono } from 'hono';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { getRequestByToken } from '@/requests/read';
import { upsertDraft } from '@/answers/draft';
import { submit } from '@/answers/submit';
import { AppError } from '@/lib/errors';

export function buildPublicApi(db: DB | TestDB) {
  const r = new Hono();

  r.get('/:token', async (c) => {
    const token = c.req.param('token');
    const req = await getRequestByToken(db, token);
    if (!req) throw new AppError('not_found', 'Request not found', 404);
    if (req.status === 'pulled') {
      throw new AppError('already_pulled', 'This questionnaire has been closed by the developer.', 410);
    }
    if (req.status === 'cancelled') {
      throw new AppError('cancelled', 'This questionnaire has been cancelled.', 410);
    }
    return c.json({
      displayName: req.displayName,
      projectName: req.projectName ?? undefined,
      title: req.title,
      intro: req.intro ?? undefined,
      questions: req.questions,
      draftAnswers: req.draftAnswers ?? undefined,
      status: req.status,
    });
  });

  r.put('/:token/draft', async (c) => {
    const token = c.req.param('token');
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new AppError('validation_failed', 'JSON object body required', 400);
    }
    await upsertDraft(db, token, body as Record<string, unknown>);
    return c.json({ ok: true });
  });

  r.post('/:token/submit', async (c) => {
    const token = c.req.param('token');
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new AppError('validation_failed', 'JSON object body required', 400);
    }
    await submit(db, token, body as Record<string, unknown>);
    return c.json({ ok: true });
  });

  return r;
}
