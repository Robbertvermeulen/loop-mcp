import { eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { users, type User } from '@/db/schema';
import { newUlid } from '@/lib/ids';
import { hashPassword, verifyPassword } from '@/lib/passwords';
import { now } from '@/lib/time';
import { AppError } from '@/lib/errors';

type AnyDb = DB | TestDB;

export async function signupUser(
  db: AnyDb,
  input: { email: string; password: string; displayName: string }
): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    throw new AppError('validation_failed', 'Invalid email', 400);
  }
  if (input.password.length < 8) {
    throw new AppError('validation_failed', 'Password must be at least 8 characters', 400);
  }
  if (input.displayName.trim().length === 0) {
    throw new AppError('validation_failed', 'displayName required', 400);
  }

  const existing = await getUserByEmail(db, email);
  if (existing) {
    throw new AppError('conflict', 'Email already in use', 409);
  }

  const passwordHash = await hashPassword(input.password);
  const row = {
    id: newUlid(),
    email,
    passwordHash,
    displayName: input.displayName.trim(),
    createdAt: now(),
  };
  await db.insert(users).values(row);
  return row;
}

export async function getUserByEmail(db: AnyDb, email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(db: AnyDb, id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function verifyUserPassword(
  db: AnyDb,
  email: string,
  password: string
): Promise<User | null> {
  const u = await getUserByEmail(db, email);
  if (!u) return null;
  const ok = await verifyPassword(password, u.passwordHash);
  return ok ? u : null;
}
