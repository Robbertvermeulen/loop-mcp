import { test, expect } from 'bun:test';
import { QuestionSchema, AnswersSchema, validateAnswersFor } from './schema';

test('QuestionSchema accepts each valid type', () => {
  expect(QuestionSchema.safeParse({ id: 'q1', type: 'text_short', prompt: 'name?' }).success).toBe(true);
  expect(QuestionSchema.safeParse({ id: 'q2', type: 'text_long', prompt: 'bio?' }).success).toBe(true);
  expect(QuestionSchema.safeParse({ id: 'q3', type: 'single_choice', prompt: 'a?', options: ['x', 'y'] }).success).toBe(true);
  expect(QuestionSchema.safeParse({ id: 'q4', type: 'multi_choice', prompt: 'b?', options: ['x', 'y'] }).success).toBe(true);
});

test('QuestionSchema rejects single_choice without options', () => {
  const r = QuestionSchema.safeParse({ id: 'q3', type: 'single_choice', prompt: 'a?' });
  expect(r.success).toBe(false);
});

test('validateAnswersFor accepts well-shaped answers', () => {
  const questions = [
    { id: 'q1', type: 'text_short', prompt: 'a?' } as const,
    { id: 'q2', type: 'single_choice', prompt: 'b?', options: ['x', 'y'] } as const,
    { id: 'q3', type: 'multi_choice', prompt: 'c?', options: ['x', 'y', 'z'] } as const,
  ];
  const answers = {
    q1: 'hi',
    q2: { value: 'x' },
    q3: { values: ['x', 'z'] },
  };
  const r = validateAnswersFor(questions, answers);
  expect(r.success).toBe(true);
});

test('validateAnswersFor rejects mismatched type', () => {
  const questions = [{ id: 'q1', type: 'text_short', prompt: 'a?' } as const];
  const r = validateAnswersFor(questions, { q1: { value: 'wrong' } });
  expect(r.success).toBe(false);
});

test('validateAnswersFor rejects unknown question ids', () => {
  const questions = [{ id: 'q1', type: 'text_short', prompt: 'a?' } as const];
  const r = validateAnswersFor(questions, { q1: 'ok', extra: 'no' });
  expect(r.success).toBe(false);
});

test('validateAnswersFor in draft mode allows missing required answers', () => {
  const questions = [
    { id: 'q1', type: 'text_short', prompt: 'a?', required: true } as const,
  ];
  const r = validateAnswersFor(questions, {}, { draft: true });
  expect(r.success).toBe(true);
});

test('validateAnswersFor in final mode rejects missing required answers', () => {
  const questions = [
    { id: 'q1', type: 'text_short', prompt: 'a?', required: true } as const,
  ];
  const r = validateAnswersFor(questions, {}, { draft: false });
  expect(r.success).toBe(false);
});
