interface IntroPageProps {
  displayName: string;
  projectName?: string;
  title: string;
  intro?: string;
  questionCount: number;
  onStart: () => void;
}

export default function IntroPage(props: IntroPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
      <p class="text-sm text-neutral-500">
        {props.displayName}
        {props.projectName ? ` — ${props.projectName}` : ''}
      </p>
      <h1 class="text-3xl mt-2">{props.title}</h1>
      {props.intro && <p class="mt-4 whitespace-pre-wrap">{props.intro}</p>}
      <p class="mt-6 text-sm text-neutral-500">
        {props.questionCount} {props.questionCount === 1 ? 'question' : 'questions'}
      </p>
      <button class="mt-8 px-6 py-3 bg-black text-white" onClick={props.onStart}>
        Start
      </button>
    </div>
  );
}
