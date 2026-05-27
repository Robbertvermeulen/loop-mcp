interface ClosedPageProps {
  reason: 'pulled' | 'cancelled' | 'not_found';
}

export default function ClosedPage(props: ClosedPageProps) {
  const message = () => {
    switch (props.reason) {
      case 'pulled':
        return 'This questionnaire has been completed and processed.';
      case 'cancelled':
        return 'This questionnaire was cancelled.';
      case 'not_found':
        return 'This link is invalid or has expired.';
    }
  };

  const title = () => {
    switch (props.reason) {
      case 'pulled':
        return 'Already received.';
      case 'cancelled':
        return 'Link closed.';
      case 'not_found':
        return 'Not found.';
    }
  };

  return (
    <div class="min-h-screen flex flex-col items-center justify-center px-6 md:px-10 py-24 text-center bg-[var(--paper-deep)]">
      <h1 class="rise rise-1 font-display font-medium text-4xl leading-snug tracking-tight text-ink">
        {title()}
      </h1>
      <p class="rise rise-2 mt-5 text-base leading-relaxed text-[var(--gray-warm)] font-sans max-w-xs">
        {message()}
      </p>
    </div>
  );
}
