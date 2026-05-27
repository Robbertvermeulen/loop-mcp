import { z } from 'zod';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { pullResponse } from '@/requests/read';
import { AppError } from '@/lib/errors';

export const getResponseInputSchema = z.object({
  ref: z.string().min(1).describe('id or slug of the request'),
});

export const getResponseTool = {
  name: 'get_response',
  description:
    'Fetch a submitted response and atomically mark it as pulled. SIDE EFFECT: transitions submitted → pulled. After pull, the recipient can no longer edit. Use peek_response to inspect without claiming.',
  inputSchema: getResponseInputSchema,
};

export type GetResponseInput = z.infer<typeof getResponseInputSchema>;

export async function getResponseHandler(
  db: DB | TestDB,
  user: User,
  input: GetResponseInput
) {
  const r = await pullResponse(db, user.id, input.ref);
  if (!r) throw new AppError('not_found', 'Request not found', 404, { ref: input.ref });
  return shapeResponseForClaude(r);
}

export function shapeResponseForClaude(r: {
  id: string;
  slug: string;
  title: string;
  projectName: string | null;
  status: string;
  context: string | null;
  questions: unknown[];
  finalAnswers: Record<string, unknown> | null;
}) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    projectName: r.projectName ?? undefined,
    status: r.status,
    context: r.context ?? undefined,
    questions: r.questions,
    answers: r.finalAnswers ?? undefined,
  };
}
