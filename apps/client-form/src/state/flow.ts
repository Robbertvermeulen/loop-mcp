import { createSignal } from 'solid-js';
import type { PublicView, Question, Answer, Answers } from '../types';

export type FlowPhase = 'intro' | 'question' | 'submit' | 'thankYou';

export interface Flow {
  questions: Question[];
  phase: () => FlowPhase;
  stepIndex: () => number;
  answers: () => Answers;
  currentQuestion: () => Question | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  setAnswer: (id: string, value: Answer) => void;
  canAdvance: () => boolean;
  markSubmitted: () => void;
  reopen: () => void;
}

export function createFlow(view: PublicView): Flow {
  const [phase, setPhase] = createSignal<FlowPhase>('intro');
  const [stepIndex, setStepIndex] = createSignal(0);
  const [answers, setAnswers] = createSignal<Answers>(view.draftAnswers ?? {});

  const questions = view.questions;

  const currentQuestion = () => {
    const i = stepIndex();
    return questions[i] ?? null;
  };

  const start = () => {
    setPhase('question');
    setStepIndex(0);
  };

  const setAnswer = (id: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const next = () => {
    if (phase() !== 'question') return;
    const i = stepIndex();
    if (i < questions.length - 1) {
      setStepIndex(i + 1);
    } else {
      setPhase('submit');
    }
  };

  const prev = () => {
    if (phase() !== 'question') return;
    const i = stepIndex();
    if (i > 0) setStepIndex(i - 1);
    else setPhase('intro');
  };

  const canAdvance = () => {
    const q = currentQuestion();
    if (!q) return false;
    const a = answers()[q.id];
    return isAnswerSufficient(q, a);
  };

  const markSubmitted = () => setPhase('thankYou');

  const reopen = () => {
    setPhase('question');
    setStepIndex(0);
  };

  return {
    questions,
    phase,
    stepIndex,
    answers,
    currentQuestion,
    start,
    next,
    prev,
    setAnswer,
    canAdvance,
    markSubmitted,
    reopen,
  };
}

function isAnswerSufficient(q: Question, a: Answer | undefined): boolean {
  // multi_choice with minSelections always enforces the minimum regardless of required
  if (q.type === 'multi_choice' && q.minSelections !== undefined) {
    if (a === undefined) return false;
    if (typeof a !== 'object' || Array.isArray(a)) return false;
    const mc = a as { values?: unknown };
    if (!Array.isArray(mc.values)) return false;
    return mc.values.length >= q.minSelections;
  }

  if (!q.required) return true;
  if (a === undefined) return false;
  switch (q.type) {
    case 'text_short':
    case 'text_long':
      return typeof a === 'string' && a.trim().length > 0;
    case 'single_choice': {
      if (typeof a !== 'object' || Array.isArray(a)) return false;
      const sc = a as { value?: unknown };
      return typeof sc.value === 'string' && sc.value.length > 0;
    }
    case 'multi_choice': {
      if (typeof a !== 'object' || Array.isArray(a)) return false;
      const mc = a as { values?: unknown };
      if (!Array.isArray(mc.values)) return false;
      const min = q.minSelections ?? 1;
      return mc.values.length >= min;
    }
  }
}
