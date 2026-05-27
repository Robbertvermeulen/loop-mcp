import { eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { sessions, users, type User } from '@/db/schema';
import { newUrlSafeToken } from '@/lib/ids';
import { now } from '@/lib/time';

type AnyDb = DB | TestDB;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function createSession(db: AnyDb, userId: string): Promise<{ id: string; expiresAt: number }> {
  const id = newUrlSafeToken();
  const expiresAt = now() + SESSION_TTL_MS;
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function getSessionUser(db: AnyDb, sessionId: string): Promise<User | null> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < now()) return null;
  return row.user;
}

export async function deleteSession(db: AnyDb, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
