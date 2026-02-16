export function MetricBar({
  label,
  value,
  maxValue,
  color,
  formattedValue,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  formattedValue: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate font-[family-name:var(--font-display)] text-xs text-text-secondary">
        {label}
      </span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-surface-overlay">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-[family-name:var(--font-mono)] text-xs font-semibold text-text-primary">
        {formattedValue}
      </span>
    </div>
  );
}
