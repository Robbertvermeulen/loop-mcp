import { z } from 'zod';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { createRequest } from '@/requests/create';
import { QuestionSchema } from '@/questions/schema';

export const createRequestInputSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  intro: z.string().optional(),
  context: z
    .string()
    .optional()
    .describe(
      'STRONGLY RECOMMENDED. Briefing for yourself (and future Claude sessions). Describe: what this link is about, which project/feature, what blocked, what you will do with the answers. NOT shown to the recipient.'
    ),
  projectName: z.string().optional(),
  questions: z.array(QuestionSchema).min(1).max(50),
});

export type CreateRequestInput = z.infer<typeof createRequestInputSchema>;

export async function createRequestHandler(
  db: DB | TestDB,
  user: User,
  publicBaseUrl: string,
  input: CreateRequestInput
) {
  return createRequest(db, user.id, { ...input, publicBaseUrl });
}

export const createRequestTool = {
  name: 'create_request',
  description:
    'Create a Loop request: a structured questionnaire shareable via URL. Returns the URL to share with the recipient. Use the context field to leave a briefing for your future self.',
  inputSchema: createRequestInputSchema,
};
