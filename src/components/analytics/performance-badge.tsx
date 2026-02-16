import type { PerformanceStatus } from './types';

const PERF_CONFIG: Record<PerformanceStatus, { label: string; color: string; pulse?: boolean }> = {
  viral:            { label: 'Viral',           color: 'bg-lime/10 text-lime border-lime/30' },
  converting:       { label: 'Converting',      color: 'bg-electric/10 text-electric border-electric/30' },
  underperforming:  { label: 'Underperforming', color: 'bg-magenta/10 text-magenta border-magenta/30' },
  unlinked:         { label: 'Unlinked',        color: 'bg-surface-overlay text-text-muted border-border' },
  pending:          { label: 'Syncing',         color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30', pulse: true },
};

export function PerformanceBadge({ status }: { status: PerformanceStatus }) {
  const config = PERF_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider ${config.color}`}
    >
      <StatusDot status={status} pulse={config.pulse} />
      {config.label}
    </span>
  );
}

function StatusDot({ status, pulse }: { status: PerformanceStatus; pulse?: boolean }) {
  const dotColor: Record<PerformanceStatus, string> = {
    viral: 'bg-lime',
    converting: 'bg-electric',
    underperforming: 'bg-magenta',
    unlinked: 'bg-text-muted',
    pending: 'bg-amber-hot',
  };

  return (
    <span className="relative flex h-1.5 w-1.5">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor[status]} opacity-75`} />
      )}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotColor[status]}`} />
    </span>
  );
}
