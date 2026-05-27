import type { Question, Answer } from '../types';
import type { AutosaveStatus } from '../state/autosave';
import QuestionRenderer from '../components/QuestionRenderer';
import ProgressBar from '../components/ProgressBar';

interface QuestionPageProps {
  current: number;
  total: number;
  question: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  onNext: () => void;
  onPrev: () => void;
  canAdvance: boolean;
  autosaveStatus: AutosaveStatus;
}

export default function QuestionPage(props: QuestionPageProps) {
  return (
    <div class="min-h-screen flex flex-col">
      <ProgressBar current={props.current} total={props.total} />
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="w-full max-w-xl">
          <p class="text-sm text-neutral-500">
            Question {props.current} of {props.total}
          </p>
          <div class="mt-4">
            <QuestionRenderer
              question={props.question}
              value={props.value}
              onChange={props.onChange}
              autofocus
            />
          </div>
          <div class="mt-8 flex items-center justify-between">
            <button class="text-sm" onClick={props.onPrev}>
              Back
            </button>
            <div class="text-xs text-neutral-500">
              {props.autosaveStatus === 'saving' || props.autosaveStatus === 'pending'
                ? 'Saving…'
                : props.autosaveStatus === 'error'
                ? 'Save failed — will retry'
                : 'Saved'}
            </div>
            <button
              class="px-6 py-3 bg-black text-white disabled:opacity-30"
              disabled={!props.canAdvance}
              onClick={props.onNext}
            >
              {props.current === props.total ? 'Review' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
