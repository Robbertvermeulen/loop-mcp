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
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 class="text-2xl">Link closed</h1>
      <p class="mt-4">{message()}</p>
    </div>
  );
}
