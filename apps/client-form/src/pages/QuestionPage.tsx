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

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function autosaveLabel(status: AutosaveStatus): string {
  if (status === 'saving' || status === 'pending') return 'SAVING…';
  if (status === 'error') return 'SAVE FAILED';
  return 'SAVED';
}

export default function QuestionPage(props: QuestionPageProps) {
  const isLast = () => props.current === props.total;

  return (
    <div class="min-h-screen flex flex-col bg-paper">
      {/* Progress bar — top edge */}
      <ProgressBar current={props.current} total={props.total} />

      {/* Counter row */}
      <div class="px-6 md:px-10 pt-5">
        <p class="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--gray-warm)]">
          {pad(props.current)} / {pad(props.total)}
        </p>
      </div>

      {/* Question area — vertically centered */}
      <div class="flex-1 flex items-center justify-center px-6 md:px-10 py-12">
        <div class="w-full max-w-[34rem]">
          <div class="rise rise-1">
            <QuestionRenderer
              question={props.question}
              value={props.value}
              onChange={props.onChange}
              autofocus
            />
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div class="px-6 md:px-10 pb-8 max-w-[34rem] mx-auto w-full">
        <div class="flex items-center justify-between gap-4">
          <button class="btn-ghost text-sm" onClick={props.onPrev}>
            Back
          </button>

          <span class="font-mono text-[10px] uppercase tracking-widest text-[var(--gray-warm)] hidden sm:block">
            {autosaveLabel(props.autosaveStatus)}
          </span>

          <button
            class="btn-clay text-sm uppercase tracking-widest px-6 py-3"
            disabled={!props.canAdvance}
            onClick={props.onNext}
          >
            {isLast() ? 'Review' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
