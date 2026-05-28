import { createResource, createEffect, Show, Switch, Match } from 'solid-js';
import { fetchView, saveDraft, submitFinal, ApiError } from './api';
import type { Answer, Answers, PublicView } from './types';
import { createFlow } from './state/flow';
import { createAutosave } from './state/autosave';
import LoadingPage from './pages/LoadingPage';
import ErrorPage from './pages/ErrorPage';
import ClosedPage from './pages/ClosedPage';
import IntroPage from './pages/IntroPage';
import QuestionPage from './pages/QuestionPage';
import ThankYouPage from './pages/ThankYouPage';

function tokenFromUrl(): string {
  const path = window.location.pathname;
  const m = path.match(/^\/r\/([^/]*)/);
  return m?.[1] ?? '';
}

type ViewResult =
  | PublicView
  | { closed: 'pulled' | 'cancelled' | 'not_found' }
  | { error: string; code?: string };

export default function App() {
  const token = tokenFromUrl();

  const [view] = createResource<ViewResult, string>(
    () => token,
    async (t: string) => {
      if (!t) return { closed: 'not_found' as const };
      try {
        return await fetchView(t);
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.status === 410 && e.code === 'already_pulled') return { closed: 'pulled' as const };
          if (e.status === 410 && e.code === 'cancelled') return { closed: 'cancelled' as const };
          if (e.status === 404) return { closed: 'not_found' as const };
          return { error: e.message, code: e.code };
        }
        return { error: 'Network error' };
      }
    }
  );

  return (
    <Switch fallback={<LoadingPage />}>
      <Match when={view.loading}>
        <LoadingPage />
      </Match>
      <Match when={view() && 'closed' in (view() as object)}>
        <ClosedPage reason={(view() as { closed: 'pulled' | 'cancelled' | 'not_found' }).closed} />
      </Match>
      <Match when={view() && 'error' in (view() as object)}>
        <ErrorPage
          message={(view() as { error: string }).error}
          code={(view() as { code?: string }).code}
        />
      </Match>
      <Match when={view() && 'questions' in (view() as object)}>
        <Running view={view() as PublicView} token={token} />
      </Match>
    </Switch>
  );
}

function Running(props: { view: PublicView; token: string }) {
  const flow = createFlow(props.view);
  const auto = createAutosave({
    saveFn: async (data: Answers) => {
      await saveDraft(props.token, data);
    },
    debounceMs: 800,
  });

  createEffect(() => {
    const phase = flow.phase();
    if (phase === 'question') {
      auto.schedule(flow.answers());
    }
  });

  const handleChange = (id: string) => (v: Answer) => {
    flow.setAnswer(id, v);
  };

  const handleSubmit = async () => {
    await auto.flush();
    try {
      await submitFinal(props.token, flow.answers());
      flow.markSubmitted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Submission failed');
    }
  };

  return (
    <Switch>
      <Match when={flow.phase() === 'intro'}>
        <IntroPage
          displayName={props.view.displayName}
          projectName={props.view.projectName}
          title={props.view.title}
          intro={props.view.intro}
          questionCount={props.view.questions.length}
          onStart={() => flow.start()}
        />
      </Match>
      <Match when={flow.phase() === 'question'}>
        <Show when={flow.currentQuestion()}>
          {(q) => (
            <QuestionPage
              current={flow.stepIndex() + 1}
              total={props.view.questions.length}
              question={q()}
              value={flow.answers()[q().id]}
              onChange={handleChange(q().id)}
              onNext={() => flow.next()}
              onPrev={() => flow.prev()}
              canAdvance={flow.canAdvance()}
              autosaveStatus={auto.status()}
            />
          )}
        </Show>
      </Match>
      <Match when={flow.phase() === 'submit'}>
        <div class="min-h-screen flex flex-col items-center justify-center px-6 md:px-10 py-24 max-w-[34rem] mx-auto text-left">
          <h1 class="rise rise-1 font-display font-medium text-5xl md:text-6xl leading-[1.05] tracking-tight text-ink w-full">
            Ready to send?
          </h1>
          <p class="rise rise-2 mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--gray-warm)] w-full">
            {Object.keys(flow.answers()).length} of {props.view.questions.length} answered
          </p>
          <div class="rise rise-3 mt-10 flex items-center gap-6 w-full">
            <button class="btn-ghost text-sm" onClick={() => flow.prev()}>Back</button>
            <button class="btn-clay text-sm uppercase tracking-widest px-8 py-4" onClick={handleSubmit}>
              Send answers
            </button>
          </div>
        </div>
      </Match>
      <Match when={flow.phase() === 'thankYou'}>
        <ThankYouPage displayName={props.view.displayName} onReopen={() => flow.reopen()} />
      </Match>
    </Switch>
  );
}
