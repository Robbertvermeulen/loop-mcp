import { eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { requests } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { getRequestByToken } from '@/requests/read';
import { validateAnswersFor } from '@/questions/schema';

type AnyDb = DB | TestDB;

export async function upsertDraft(
  db: AnyDb,
  token: string,
  draft: Record<string, unknown>
): Promise<void> {
  const r = await getRequestByToken(db, token);
  if (!r) throw new AppError('not_found', 'Request not found', 404);
  if (r.status === 'cancelled') {
    throw new AppError('cancelled', 'Request was cancelled', 410);
  }
  if (r.status === 'pulled') {
    throw new AppError('already_pulled', 'Request already pulled by developer', 409);
  }
  const v = validateAnswersFor(r.questions, draft, { draft: true });
  if (!v.success) {
    throw new AppError('validation_failed', v.error, 400);
  }
  await db
    .update(requests)
    .set({ draftAnswers: JSON.stringify(v.data) })
    .where(eq(requests.id, r.id));
}
