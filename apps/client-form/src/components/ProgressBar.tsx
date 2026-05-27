interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar(props: ProgressBarProps) {
  const pct = () => (props.total === 0 ? 0 : Math.round((props.current / props.total) * 100));
  return (
    <div class="w-full h-1 bg-neutral-200">
      <div class="h-1 bg-black transition-all" style={{ width: `${pct()}%` }} />
    </div>
  );
}
