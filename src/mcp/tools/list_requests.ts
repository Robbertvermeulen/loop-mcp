import { z } from 'zod';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { listRequests } from '@/requests/list';

export const listRequestsInputSchema = z.object({
  status: z
    .enum(['pending', 'submitted', 'pulled', 'cancelled', 'any'])
    .optional()
    .describe("Default: pending+submitted. Use 'any' for all statuses."),
  projectName: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const listRequestsTool = {
  name: 'list_requests',
  description:
    'List your Loop requests with summary fields and a contextExcerpt. Use this at the start of a new session to remember what is open, or to find a slug.',
  inputSchema: listRequestsInputSchema,
};

export type ListRequestsInput = z.infer<typeof listRequestsInputSchema>;

export async function listRequestsHandler(
  db: DB | TestDB,
  user: User,
  input: ListRequestsInput
) {
  const status =
    input.status === 'any'
      ? (['pending', 'submitted', 'pulled', 'cancelled'] as const)
      : input.status
      ? [input.status]
      : undefined;
  return listRequests(db, user.id, {
    status: status as ('pending' | 'submitted' | 'pulled' | 'cancelled')[] | undefined,
    projectName: input.projectName,
    limit: input.limit,
  });
}
