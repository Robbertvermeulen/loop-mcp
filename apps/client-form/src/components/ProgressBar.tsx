interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar(props: ProgressBarProps) {
  const pct = () => (props.total === 0 ? 0 : Math.round((props.current / props.total) * 100));
  return (
    <div class="w-full h-[2px] bg-[var(--paper-deep)]">
      <div
        class="h-[2px] bg-[var(--clay)] transition-all duration-500 ease-out"
        style={{ width: `${pct()}%` }}
      />
    </div>
  );
}
