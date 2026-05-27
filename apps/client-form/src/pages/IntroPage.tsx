interface IntroPageProps {
  displayName: string;
  projectName?: string;
  title: string;
  intro?: string;
  questionCount: number;
  onStart: () => void;
}

export default function IntroPage(props: IntroPageProps) {
  const count = () => String(props.questionCount).padStart(2, '0');
  const label = () => (props.questionCount === 1 ? 'QUESTION' : 'QUESTIONS');

  return (
    <div class="min-h-screen flex flex-col items-start justify-center px-6 md:px-10 py-24 max-w-[34rem] mx-auto">
      {/* Sender stamp */}
      <p class="rise rise-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--gray-warm)] mb-10">
        {props.displayName}
        {props.projectName ? ` — ${props.projectName}` : ''}
      </p>

      {/* Headline */}
      <h1 class="rise rise-2 font-display font-medium text-5xl md:text-6xl leading-[1.05] tracking-tight text-ink">
        {props.title}
      </h1>

      {/* Intro body */}
      {props.intro && (
        <p class="rise rise-3 mt-8 ml-2 text-base leading-relaxed text-[var(--gray-warm)] font-sans whitespace-pre-wrap max-w-[28rem]">
          {props.intro}
        </p>
      )}

      {/* Question count */}
      <p class="rise rise-4 mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--gray-warm)]">
        {count()} {label()}
      </p>

      {/* CTA */}
      <button
        class="rise rise-5 btn-clay mt-10 w-full md:w-auto md:min-w-[10rem] text-center uppercase tracking-widest text-sm"
        onClick={props.onStart}
      >
        Start
      </button>
    </div>
  );
}
