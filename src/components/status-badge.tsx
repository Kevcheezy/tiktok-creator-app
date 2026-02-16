import { STATUS_EFFECTS, type StatusEffect } from './ff7-theme';

const STATUS_CONFIG: Record<string, { effect: StatusEffect; color: string; pulse?: boolean }> = {
  created: {
    effect: STATUS_EFFECTS.created,
    color: 'bg-text-muted/20 text-text-muted border-text-muted/30',
  },
  analyzing: {
    effect: STATUS_EFFECTS.analyzing,
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  analysis_review: {
    effect: STATUS_EFFECTS.analysis_review,
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  scripting: {
    effect: STATUS_EFFECTS.scripting,
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  script_review: {
    effect: STATUS_EFFECTS.script_review,
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  broll_planning: {
    effect: STATUS_EFFECTS.broll_planning,
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  broll_review: {
    effect: STATUS_EFFECTS.broll_review,
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  broll_generation: {
    effect: STATUS_EFFECTS.broll_generation,
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  influencer_selection: {
    effect: STATUS_EFFECTS.influencer_selection,
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  casting: {
    effect: STATUS_EFFECTS.casting,
    color: 'bg-magenta/10 text-magenta border-magenta/30',
    pulse: true,
  },
  casting_review: {
    effect: STATUS_EFFECTS.casting_review,
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  directing: {
    effect: STATUS_EFFECTS.directing,
    color: 'bg-magenta/10 text-magenta border-magenta/30',
    pulse: true,
  },
  voiceover: {
    effect: STATUS_EFFECTS.voiceover,
    color: 'bg-summon/10 text-summon border-summon/30',
    pulse: true,
  },
  asset_review: {
    effect: STATUS_EFFECTS.asset_review,
    color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30',
  },
  editing: {
    effect: STATUS_EFFECTS.editing,
    color: 'bg-electric/10 text-electric border-electric/30',
    pulse: true,
  },
  completed: {
    effect: STATUS_EFFECTS.completed,
    color: 'bg-lime/10 text-lime border-lime/30',
  },
  failed: {
    effect: STATUS_EFFECTS.failed,
    color: 'bg-magenta/10 text-magenta border-magenta/30',
  },
};

function StatusIcon({ icon }: { icon: StatusEffect['icon'] }) {
  const cls = 'h-2.5 w-2.5 flex-shrink-0';

  switch (icon) {
    case 'scan':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx="5" cy="5" r="3.5" />
          <line x1="7.5" y1="7.5" x2="10" y2="10" />
        </svg>
      );
    case 'haste':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <polyline points="2 8 6 4 10 8" />
          <polyline points="2 6 6 2 10 6" />
        </svg>
      );
    case 'pray':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M6 2v3M3 7l3-2 3 2M4 9l2-1 2 1" />
        </svg>
      );
    case 'summon':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx="6" cy="6" r="4" />
          <circle cx="6" cy="6" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'fury':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M3 9l3-7 3 7M4 6h4" />
        </svg>
      );
    case 'esuna':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 3c0 0 1.5 1 2 3s2 3 2 3" />
          <path d="M4 5c0 0 1.5 1 2 3" />
        </svg>
      );
    case 'barrier':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 1L2 3v4c0 2.5 4 4 4 4s4-1.5 4-4V3L6 1z" />
        </svg>
      );
    case 'wait':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx="6" cy="6" r="4.5" />
          <polyline points="6 3.5 6 6 8 7.5" />
        </svg>
      );
    case 'recruit':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <circle cx="4.5" cy="4" r="2" />
          <path d="M1 10c0-2 1.5-3 3.5-3s3.5 1 3.5 3" />
          <line x1="9" y1="4" x2="9" y2="8" />
          <line x1="7" y1="6" x2="11" y2="6" />
        </svg>
      );
    case 'victory':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="currentColor">
          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" />
        </svg>
      );
    case 'ko':
      return (
        <svg viewBox="0 0 12 12" className={cls} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      );
    default:
      return null;
  }
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-wider ${config.color}`}
    >
      {config.pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : (
        <StatusIcon icon={config.effect.icon} />
      )}
      {config.effect.label}
    </span>
  );
}
