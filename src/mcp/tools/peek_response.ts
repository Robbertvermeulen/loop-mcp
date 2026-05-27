import { z } from 'zod';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { peekResponse } from '@/requests/read';
import { AppError } from '@/lib/errors';
import { shapeResponseForClaude } from './get_response';

export const peekResponseInputSchema = z.object({
  ref: z.string().min(1).describe('id or slug of the request'),
});

export const peekResponseTool = {
  name: 'peek_response',
  description:
    'Look at a response WITHOUT marking it as pulled. Use this if you want to inspect before claiming. Does NOT have side effects.',
  inputSchema: peekResponseInputSchema,
};

export type PeekResponseInput = z.infer<typeof peekResponseInputSchema>;

export async function peekResponseHandler(
  db: DB | TestDB,
  user: User,
  input: PeekResponseInput
) {
  const r = await peekResponse(db, user.id, input.ref);
  if (!r) throw new AppError('not_found', 'Request not found', 404, { ref: input.ref });
  return shapeResponseForClaude(r);
}
