import { z } from 'zod';

const TextShort = z.object({
  id: z.string().min(1),
  type: z.literal('text_short'),
  prompt: z.string().min(1),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
});

const TextLong = z.object({
  id: z.string().min(1),
  type: z.literal('text_long'),
  prompt: z.string().min(1),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
});

const SingleChoice = z.object({
  id: z.string().min(1),
  type: z.literal('single_choice'),
  prompt: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1)).min(2).readonly(),
  allowOther: z.boolean().optional(),
});

const MultiChoice = z.object({
  id: z.string().min(1),
  type: z.literal('multi_choice'),
  prompt: z.string().min(1),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1)).min(2).readonly(),
  minSelections: z.number().int().min(0).optional(),
  maxSelections: z.number().int().min(1).optional(),
});

export const QuestionSchema = z.discriminatedUnion('type', [
  TextShort,
  TextLong,
  SingleChoice,
  MultiChoice,
]);

export type Question = z.infer<typeof QuestionSchema>;

export const QuestionsSchema = z.array(QuestionSchema).min(1).max(50);

const SingleChoiceAnswer = z.object({
  value: z.string().min(1),
  other: z.string().optional(),
});
const MultiChoiceAnswer = z.object({
  values: z.array(z.string().min(1)).min(0),
});

export const AnswersSchema = z.record(
  z.string(),
  z.union([z.string(), SingleChoiceAnswer, MultiChoiceAnswer])
);
export type Answers = z.infer<typeof AnswersSchema>;

export function validateAnswersFor(
  questions: Question[],
  answers: unknown,
  opts: { draft: boolean } = { draft: false }
): { success: true; data: Answers } | { success: false; error: string } {
  const parsed = AnswersSchema.safeParse(answers);
  if (!parsed.success) return { success: false, error: parsed.error.message };
  const data = parsed.data;
  const byId = new Map(questions.map((q) => [q.id, q]));

  for (const id of Object.keys(data)) {
    if (!byId.has(id)) return { success: false, error: `unknown question: ${id}` };
  }

  for (const q of questions) {
    const a = data[q.id];
    if (a === undefined) {
      if (q.required && !opts.draft) {
        return { success: false, error: `missing required: ${q.id}` };
      }
      continue;
    }
    const shapeErr = checkAnswerShape(q, a);
    if (shapeErr) return { success: false, error: shapeErr };
  }
  return { success: true, data };
}

function checkAnswerShape(q: Question, a: unknown): string | null {
  switch (q.type) {
    case 'text_short':
    case 'text_long':
      if (typeof a !== 'string') return `${q.id}: expected string`;
      return null;
    case 'single_choice': {
      if (typeof a !== 'object' || a === null) return `${q.id}: expected object`;
      const sc = a as { value?: unknown; other?: unknown };
      if (typeof sc.value !== 'string') return `${q.id}: expected .value string`;
      const inOptions = q.options.includes(sc.value);
      if (!inOptions && !q.allowOther) return `${q.id}: value not in options`;
      if (!inOptions && q.allowOther && typeof sc.other !== 'string') {
        return `${q.id}: other choice requires .other string`;
      }
      return null;
    }
    case 'multi_choice': {
      if (typeof a !== 'object' || a === null) return `${q.id}: expected object`;
      const mc = a as { values?: unknown };
      if (!Array.isArray(mc.values)) return `${q.id}: expected .values array`;
      for (const v of mc.values) {
        if (!q.options.includes(v as string)) return `${q.id}: invalid option ${v}`;
      }
      if (q.minSelections !== undefined && mc.values.length < q.minSelections) {
        return `${q.id}: need at least ${q.minSelections}`;
      }
      if (q.maxSelections !== undefined && mc.values.length > q.maxSelections) {
        return `${q.id}: at most ${q.maxSelections}`;
      }
      return null;
    }
  }
}
