const STATUS_CONFIG: Record<string, { label: string; color: string; pulse?: boolean }> = {
  created: {
    label: 'Created',
    color: 'bg-text-muted/20 text-text-muted border-text-muted/30',
  },
  analyzing: {
    label: 'Analyzing',
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  analysis_review: {
    label: 'Review Analysis',
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  scripting: {
    label: 'Scripting',
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  script_review: {
    label: 'Review Script',
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  casting: {
    label: 'Casting',
    color: 'bg-magenta/10 text-magenta border-magenta/30',
    pulse: true,
  },
  casting_review: {
    label: 'Review Assets',
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  directing: {
    label: 'Directing',
    color: 'bg-magenta/10 text-magenta border-magenta/30',
    pulse: true,
  },
  voiceover: {
    label: 'Voiceover',
    color: 'bg-magenta/10 text-magenta border-magenta/30',
    pulse: true,
  },
  asset_review: {
    label: 'Review Assets',
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  editing: {
    label: 'Editing',
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  completed: {
    label: 'Completed',
    color: 'bg-lime/10 text-lime border-lime/30',
  },
  failed: {
    label: 'Failed',
    color: 'bg-magenta/10 text-magenta border-magenta/30',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-wider ${config.color}`}
    >
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {config.label}
    </span>
  );
}
