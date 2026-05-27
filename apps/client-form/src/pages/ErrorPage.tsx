interface ErrorPageProps {
  message: string;
  code?: string;
}

export default function ErrorPage(props: ErrorPageProps) {
  return (
    <div class="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 class="text-2xl">Something went wrong</h1>
      <p class="mt-4">{props.message}</p>
      {props.code && <p class="mt-2 text-sm text-neutral-500">Code: {props.code}</p>}
    </div>
  );
}
