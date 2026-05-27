import { z } from 'zod';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { cancelRequest } from '@/requests/cancel';

export const cancelRequestInputSchema = z.object({
  ref: z.string().min(1).describe('id or slug of the request'),
});

export const cancelRequestTool = {
  name: 'cancel_request',
  description: 'Cancel a request. Closes the link for the recipient. Cannot be undone.',
  inputSchema: cancelRequestInputSchema,
};

export type CancelRequestInput = z.infer<typeof cancelRequestInputSchema>;

export async function cancelRequestHandler(
  db: DB | TestDB,
  user: User,
  input: CancelRequestInput
) {
  await cancelRequest(db, user.id, input.ref);
  return { ok: true };
}
