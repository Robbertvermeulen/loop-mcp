interface ThankYouPageProps {
  displayName: string;
  onReopen: () => void;
}

export default function ThankYouPage(props: ThankYouPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center px-6 md:px-10 py-24 text-center bg-paper">
      <h1 class="rise rise-1 font-display font-medium text-5xl md:text-6xl leading-[1.05] tracking-tight text-ink">
        Thank you.
      </h1>
      <p class="rise rise-2 mt-6 text-base leading-relaxed text-[var(--gray-warm)] font-sans max-w-xs">
        Your answers have been sent to {props.displayName}.
      </p>
      <p class="rise rise-3 mt-2 text-sm text-[var(--gray-soft)] font-sans">
        You can still adjust them until they read your response.
      </p>
      <button class="rise rise-4 btn-link-clay mt-10 text-sm" onClick={props.onReopen}>
        Edit answers
      </button>
    </div>
  );
}
