export default function LoadingPage() {
  return (
    <div class="min-h-screen flex items-center justify-center bg-paper">
      <p class="font-display font-medium italic text-2xl text-[var(--gray-warm)] tracking-tight select-none">
        Loading
        <span class="loading-dot">.</span>
        <span class="loading-dot">.</span>
        <span class="loading-dot">.</span>
      </p>
    </div>
  );
}
