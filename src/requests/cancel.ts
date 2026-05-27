import { and, eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { requests } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { now } from '@/lib/time';
import { getRequestByRef } from './read';

type AnyDb = DB | TestDB;

export async function cancelRequest(db: AnyDb, userId: string, ref: string): Promise<void> {
  const r = await getRequestByRef(db, userId, ref);
  if (!r) throw new AppError('not_found', 'Request not found', 404, { ref });
  if (r.status === 'cancelled') return;
  if (r.status === 'pulled') {
    throw new AppError('conflict', 'Cannot cancel a request already pulled', 409, { id: r.id });
  }
  await db
    .update(requests)
    .set({ status: 'cancelled', cancelledAt: now() })
    .where(and(eq(requests.id, r.id), eq(requests.userId, userId)));
}
