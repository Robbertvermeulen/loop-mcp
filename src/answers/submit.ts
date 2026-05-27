import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { requests } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { now } from '@/lib/time';
import { getRequestByToken } from '@/requests/read';
import { validateAnswersFor } from '@/questions/schema';

type AnyDb = DB | TestDB;

export async function submit(
  db: AnyDb,
  token: string,
  final: Record<string, unknown>
): Promise<void> {
  const r = await getRequestByToken(db, token);
  if (!r) throw new AppError('not_found', 'Request not found', 404);
  if (r.status === 'cancelled') {
    throw new AppError('cancelled', 'Request was cancelled', 410);
  }
  if (r.status === 'pulled') {
    throw new AppError('already_pulled', 'Request already pulled by developer', 409);
  }
  const v = validateAnswersFor(r.questions, final, { draft: false });
  if (!v.success) {
    throw new AppError('validation_failed', v.error, 400);
  }
  const result = await db
    .update(requests)
    .set({
      status: 'submitted',
      finalAnswers: JSON.stringify(v.data),
      submittedAt: now(),
      draftAnswers: null,
    })
    .where(
      and(
        eq(requests.id, r.id),
        inArray(requests.status, ['pending', 'submitted'] as string[])
      )
    )
    .returning({ id: requests.id });
  if (result.length === 0) {
    throw new AppError('already_pulled', 'Request was pulled or cancelled during submission', 409);
  }
}
