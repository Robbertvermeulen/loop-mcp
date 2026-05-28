interface ErrorPageProps {
  message: string;
  code?: string;
}

export default function ErrorPage(props: ErrorPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center px-6 md:px-10 py-24 text-center bg-[var(--paper-deep)]">
      <h1 class="rise rise-1 font-display font-medium italic text-4xl leading-snug tracking-tight text-ink">
        Something went wrong.
      </h1>
      <p class="rise rise-2 mt-5 text-base leading-relaxed text-[var(--gray-warm)] font-sans max-w-xs">
        {props.message}
      </p>
      {props.code && (
        <p class="rise rise-3 mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--gray-soft)] border border-[var(--gray-soft)] px-3 py-1 inline-block">
          {props.code}
        </p>
      )}
    </div>
  );
}
