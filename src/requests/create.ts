import { and, eq, inArray, count } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { requests, projects } from '@/db/schema';
import { newUlid, newUrlSafeToken } from '@/lib/ids';
import { slugifyTitle, resolveSlugCollision } from '@/lib/slugify';
import { now } from '@/lib/time';
import { AppError } from '@/lib/errors';
import { QuestionsSchema, type Question } from '@/questions/schema';

type AnyDb = DB | TestDB;

export const MAX_ACTIVE_REQUESTS_PER_USER = 100;
const ACTIVE_STATUSES = ['pending', 'submitted'] as const;

export interface CreateRequestInput {
  title: string;
  slug?: string;
  intro?: string;
  context?: string;
  projectName?: string;
  questions: Question[];
  publicBaseUrl: string;
}

export interface CreateRequestResult {
  id: string;
  slug: string;
  url: string;
  status: 'pending';
  projectId?: string;
}

export async function createRequest(
  db: AnyDb,
  userId: string,
  input: CreateRequestInput
): Promise<CreateRequestResult> {
  const parsed = QuestionsSchema.safeParse(input.questions);
  if (!parsed.success) {
    throw new AppError('validation_failed', 'Invalid questions', 400, {
      issues: parsed.error.issues,
    });
  }
  if (!input.title.trim()) {
    throw new AppError('validation_failed', 'title required', 400);
  }

  // Quota check
  const rows = await db
    .select({ n: count() })
    .from(requests)
    .where(
      and(
        eq(requests.userId, userId),
        inArray(requests.status, ACTIVE_STATUSES as unknown as string[])
      )
    );
  const n = rows[0]?.n ?? 0;
  if (n >= MAX_ACTIVE_REQUESTS_PER_USER) {
    throw new AppError(
      'quota_exceeded',
      `quota exceeded: max ${MAX_ACTIVE_REQUESTS_PER_USER} active requests`,
      429
    );
  }

  // Resolve project
  let projectId: string | undefined;
  if (input.projectName && input.projectName.trim()) {
    const name = input.projectName.trim();
    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.name, name)))
      .limit(1);
    if (existing[0]) {
      projectId = existing[0].id;
    } else {
      projectId = newUlid();
      await db.insert(projects).values({
        id: projectId,
        userId,
        name,
        createdAt: now(),
      });
    }
  }

  // Resolve slug
  const baseSlug = input.slug ? slugifyTitle(input.slug) : slugifyTitle(input.title);
  const slug = await resolveSlugForUser(db, userId, baseSlug);

  const id = newUlid();
  const token = newUrlSafeToken();
  await db.insert(requests).values({
    id,
    userId,
    projectId: projectId ?? null,
    token,
    slug,
    status: 'pending',
    title: input.title.trim(),
    intro: input.intro ?? null,
    context: input.context ?? null,
    questions: JSON.stringify(parsed.data),
    draftAnswers: null,
    finalAnswers: null,
    submittedAt: null,
    pulledAt: null,
    cancelledAt: null,
    createdAt: now(),
  });

  const base = input.publicBaseUrl.replace(/\/+$/, '');
  return {
    id,
    slug,
    url: `${base}/r/${token}`,
    status: 'pending',
    projectId,
  };
}

async function resolveSlugForUser(db: AnyDb, userId: string, base: string): Promise<string> {
  const rows = await db
    .select({ slug: requests.slug })
    .from(requests)
    .where(eq(requests.userId, userId));
  const taken = new Set(rows.map((r) => r.slug));
  return resolveSlugCollision(base, (s) => taken.has(s));
}
