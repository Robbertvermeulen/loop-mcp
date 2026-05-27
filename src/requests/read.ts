import { and, eq, or } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { requests, projects, users } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { now } from '@/lib/time';
import type { Question } from '@/questions/schema';
import type { RequestStatus } from './list';

type AnyDb = DB | TestDB;

export interface LoadedRequest {
  id: string;
  userId: string;
  slug: string;
  token: string;
  title: string;
  intro: string | null;
  context: string | null;
  status: RequestStatus;
  questions: Question[];
  draftAnswers: Record<string, unknown> | null;
  finalAnswers: Record<string, unknown> | null;
  submittedAt: number | null;
  pulledAt: number | null;
  cancelledAt: number | null;
  projectName: string | null;
  displayName: string;
}

type Predicate = NonNullable<ReturnType<typeof eq> | ReturnType<typeof and>>;

async function loadByPredicate(
  db: AnyDb,
  predicate: Predicate
): Promise<LoadedRequest | null> {
  const rows = await db
    .select({
      r: requests,
      projectName: projects.name,
      displayName: users.displayName,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.userId))
    .leftJoin(projects, eq(projects.id, requests.projectId))
    .where(predicate)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const r = row.r;
  return {
    id: r.id,
    userId: r.userId,
    slug: r.slug,
    token: r.token,
    title: r.title,
    intro: r.intro,
    context: r.context,
    status: r.status as RequestStatus,
    questions: JSON.parse(r.questions) as Question[],
    draftAnswers: r.draftAnswers ? (JSON.parse(r.draftAnswers) as Record<string, unknown>) : null,
    finalAnswers: r.finalAnswers ? (JSON.parse(r.finalAnswers) as Record<string, unknown>) : null,
    submittedAt: r.submittedAt,
    pulledAt: r.pulledAt,
    cancelledAt: r.cancelledAt,
    projectName: row.projectName,
    displayName: row.displayName,
  };
}

export async function getRequestByRef(
  db: AnyDb,
  userId: string,
  ref: string
): Promise<LoadedRequest | null> {
  const predicate = and(
    eq(requests.userId, userId),
    or(eq(requests.id, ref), eq(requests.slug, ref))
  );
  if (!predicate) return null;
  return loadByPredicate(db, predicate);
}

export async function getRequestByToken(
  db: AnyDb,
  token: string
): Promise<LoadedRequest | null> {
  return loadByPredicate(db, eq(requests.token, token));
}

export async function peekResponse(
  db: AnyDb,
  userId: string,
  ref: string
): Promise<LoadedRequest | null> {
  return getRequestByRef(db, userId, ref);
}

export async function pullResponse(
  db: AnyDb,
  userId: string,
  ref: string
): Promise<LoadedRequest | null> {
  const found = await getRequestByRef(db, userId, ref);
  if (!found) return null;

  if (found.status === 'pending') {
    throw new AppError('not_yet_submitted', 'Recipient has not submitted yet', 409, {
      id: found.id,
      status: 'pending',
    });
  }
  if (found.status === 'cancelled') {
    throw new AppError('cancelled', 'Request was cancelled', 410, { id: found.id });
  }
  if (found.status === 'pulled') {
    return found;
  }

  // status === 'submitted' → atomic transition to 'pulled'
  const result = await db
    .update(requests)
    .set({ status: 'pulled', pulledAt: now() })
    .where(and(eq(requests.id, found.id), eq(requests.status, 'submitted')))
    .returning({ id: requests.id });

  if (result.length === 0) {
    // someone else flipped it between read + update — re-read
    return getRequestByRef(db, userId, ref);
  }
  return { ...found, status: 'pulled', pulledAt: now() };
}
