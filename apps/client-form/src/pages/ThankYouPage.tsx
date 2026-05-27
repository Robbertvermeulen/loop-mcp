interface ThankYouPageProps {
  displayName: string;
  onReopen: () => void;
}

export default function ThankYouPage(props: ThankYouPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 class="text-3xl">Thank you</h1>
      <p class="mt-4">Your answers have been sent to {props.displayName}.</p>
      <p class="mt-2 text-sm text-neutral-500">
        You can still adjust them until they read your response.
      </p>
      <button class="mt-8 underline" onClick={props.onReopen}>
        Edit answers
      </button>
    </div>
  );
}
