import { and, eq, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { apiTokens, users, type User, type ApiToken } from '@/db/schema';
import { newUlid, newUrlSafeToken } from '@/lib/ids';
import { now } from '@/lib/time';

type AnyDb = DB | TestDB;

export const TOKEN_PREFIX = 'lp_';

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export async function createApiToken(
  db: AnyDb,
  userId: string,
  label: string
): Promise<{ id: string; plain: string }> {
  const id = newUlid();
  const plain = `${TOKEN_PREFIX}${newUrlSafeToken()}`;
  const tokenHash = hashToken(plain);
  await db.insert(apiTokens).values({
    id,
    userId,
    tokenHash,
    label,
    lastUsedAt: null,
    createdAt: now(),
  });
  return { id, plain };
}

export async function verifyApiToken(
  db: AnyDb,
  plain: string
): Promise<{ user: User; tokenId: string } | null> {
  if (!plain.startsWith(TOKEN_PREFIX)) return null;
  const tokenHash = hashToken(plain);
  const rows = await db
    .select({ token: apiTokens, user: users })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // Best-effort update of lastUsedAt (don't await — fire-and-forget acceptable in MVP)
  void db
    .update(apiTokens)
    .set({ lastUsedAt: now() })
    .where(eq(apiTokens.id, row.token.id))
    .catch(() => { /* best-effort; ignore */ });

  return { user: row.user, tokenId: row.token.id };
}

export type ApiTokenSummary = Omit<ApiToken, 'tokenHash'>;

export async function listApiTokens(db: AnyDb, userId: string): Promise<ApiTokenSummary[]> {
  const rows = await db
    .select({
      id: apiTokens.id,
      userId: apiTokens.userId,
      label: apiTokens.label,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
  return rows;
}

export async function revokeApiToken(db: AnyDb, userId: string, tokenId: string): Promise<void> {
  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)));
}
