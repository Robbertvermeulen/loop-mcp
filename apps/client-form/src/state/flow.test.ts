import { test, expect } from 'bun:test';
import { createFlow, type FlowPhase } from './flow';
import type { PublicView } from '../types';

const view: PublicView = {
  displayName: 'Robbert',
  title: 'Test',
  questions: [
    { id: 'q1', type: 'text_short', prompt: 'q1?', required: true },
    { id: 'q2', type: 'single_choice', prompt: 'q2?', options: ['a', 'b'], required: true },
  ],
  status: 'pending',
};

test('createFlow starts in intro phase with empty answers (no draft)', () => {
  const f = createFlow(view);
  expect(f.phase()).toBe('intro' as FlowPhase);
  expect(f.stepIndex()).toBe(0);
  expect(f.answers()).toEqual({});
});

test('createFlow seeds answers from draftAnswers when provided', () => {
  const f = createFlow({ ...view, draftAnswers: { q1: 'hello' } });
  expect(f.answers()).toEqual({ q1: 'hello' });
});

test('start() moves to question phase at step 0', () => {
  const f = createFlow(view);
  f.start();
  expect(f.phase()).toBe('question' as FlowPhase);
  expect(f.stepIndex()).toBe(0);
});

test('setAnswer updates the signal', () => {
  const f = createFlow(view);
  f.start();
  f.setAnswer('q1', 'value');
  expect(f.answers()).toEqual({ q1: 'value' });
});

test('next() advances; final next moves to submit phase', () => {
  const f = createFlow(view);
  f.start();
  expect(f.stepIndex()).toBe(0);
  f.next();
  expect(f.stepIndex()).toBe(1);
  f.next();
  expect(f.phase()).toBe('submit' as FlowPhase);
});

test('prev() goes back; from step 0, prev() goes back to intro', () => {
  const f = createFlow(view);
  f.start();
  f.next();
  expect(f.stepIndex()).toBe(1);
  f.prev();
  expect(f.stepIndex()).toBe(0);
  f.prev();
  expect(f.phase()).toBe('intro' as FlowPhase);
});

test('canAdvance: required text answer must be non-empty string', () => {
  const f = createFlow(view);
  f.start();
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q1', '');
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q1', 'hi');
  expect(f.canAdvance()).toBe(true);
});

test('canAdvance: optional text answer always allows advance', () => {
  const f = createFlow({
    ...view,
    questions: [{ id: 'q', type: 'text_short', prompt: 'q?' }],
  });
  f.start();
  expect(f.canAdvance()).toBe(true);
});

test('canAdvance: required single_choice needs .value', () => {
  const f = createFlow({
    ...view,
    questions: [{ id: 'q', type: 'single_choice', prompt: 'q?', options: ['a', 'b'], required: true }],
  });
  f.start();
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q', { value: 'a' });
  expect(f.canAdvance()).toBe(true);
});

test('canAdvance: multi_choice respects minSelections', () => {
  const f = createFlow({
    ...view,
    questions: [{ id: 'q', type: 'multi_choice', prompt: 'q?', options: ['a', 'b', 'c'], minSelections: 2 }],
  });
  f.start();
  f.setAnswer('q', { values: ['a'] });
  expect(f.canAdvance()).toBe(false);
  f.setAnswer('q', { values: ['a', 'b'] });
  expect(f.canAdvance()).toBe(true);
});

test('markSubmitted moves phase to thankYou', () => {
  const f = createFlow(view);
  f.start();
  f.markSubmitted();
  expect(f.phase()).toBe('thankYou' as FlowPhase);
});

test('reopen from thankYou returns to question at step 0', () => {
  const f = createFlow(view);
  f.start();
  f.markSubmitted();
  f.reopen();
  expect(f.phase()).toBe('question' as FlowPhase);
  expect(f.stepIndex()).toBe(0);
});

test('prev() from submit phase returns to the last question', () => {
  const f = createFlow(view);
  f.start();
  // navigate to last question and into submit
  f.next();
  f.next();
  expect(f.phase()).toBe('submit' as FlowPhase);
  f.prev();
  expect(f.phase()).toBe('question' as FlowPhase);
  expect(f.stepIndex()).toBe(view.questions.length - 1);
});
