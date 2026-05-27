import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { verifyApiToken } from '@/auth/tokens';
import { AppError } from '@/lib/errors';

export async function authenticateBearer(
  db: DB | TestDB,
  header: string | undefined
): Promise<User> {
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('auth_failed', 'Missing or invalid Authorization header', 401);
  }
  const plain = header.slice('Bearer '.length).trim();
  const result = await verifyApiToken(db, plain);
  if (!result) {
    throw new AppError('auth_failed', 'Invalid API token', 401);
  }
  return result.user;
}
