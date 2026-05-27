import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { requests, projects } from '@/db/schema';

type AnyDb = DB | TestDB;

export type RequestStatus = 'pending' | 'submitted' | 'pulled' | 'cancelled';

export interface ListRequestsInput {
  status?: RequestStatus[];
  projectName?: string;
  limit?: number;
}

export interface RequestSummary {
  id: string;
  slug: string;
  title: string;
  projectName?: string;
  status: RequestStatus;
  contextExcerpt?: string;
  createdAt: number;
  submittedAt?: number;
  answerCount: number;
  totalQuestions: number;
}

const DEFAULT_STATUS: RequestStatus[] = ['pending', 'submitted'];
const DEFAULT_LIMIT = 20;
const CONTEXT_EXCERPT_LEN = 200;

export async function listRequests(
  db: AnyDb,
  userId: string,
  input: ListRequestsInput
): Promise<RequestSummary[]> {
  const statuses = input.status && input.status.length > 0 ? input.status : DEFAULT_STATUS;
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_LIMIT, 100));

  const baseWhere = and(
    eq(requests.userId, userId),
    inArray(requests.status, statuses as string[])
  );

  const rows = await db
    .select({
      id: requests.id,
      slug: requests.slug,
      title: requests.title,
      status: requests.status,
      context: requests.context,
      createdAt: requests.createdAt,
      submittedAt: requests.submittedAt,
      questions: requests.questions,
      finalAnswers: requests.finalAnswers,
      projectName: projects.name,
    })
    .from(requests)
    .leftJoin(projects, eq(projects.id, requests.projectId))
    .where(baseWhere)
    .orderBy(desc(requests.createdAt))
    .limit(limit);

  const filtered = input.projectName
    ? rows.filter((r) => r.projectName === input.projectName)
    : rows;

  return filtered.map((r) => {
    const questions = JSON.parse(r.questions) as unknown[];
    const final = r.finalAnswers ? (JSON.parse(r.finalAnswers) as Record<string, unknown>) : null;
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      projectName: r.projectName ?? undefined,
      status: r.status as RequestStatus,
      contextExcerpt: r.context ? r.context.slice(0, CONTEXT_EXCERPT_LEN) : undefined,
      createdAt: r.createdAt,
      submittedAt: r.submittedAt ?? undefined,
      answerCount: final ? Object.keys(final).length : 0,
      totalQuestions: questions.length,
    };
  });
}
