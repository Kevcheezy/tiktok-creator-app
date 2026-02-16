'use client';

import { GilDisplay } from './gil-display';

export type StatFilter = 'battle' | 'review' | 'victory' | 'ko' | null;

interface QuestStatsProps {
  inBattle: number;
  awaitingOrders: number;
  victories: number;
  ko: number;
  totalGil: number;
  activeFilter: StatFilter;
  onFilterChange: (filter: StatFilter) => void;
}

export function QuestStats({
  inBattle,
  awaitingOrders,
  victories,
  ko,
  totalGil,
  activeFilter,
  onFilterChange,
}: QuestStatsProps) {
  function toggle(key: Exclude<StatFilter, null>) {
    onFilterChange(activeFilter === key ? null : key);
  }

  return (
    <div className="glass flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
      <StatButton
        active={activeFilter === 'battle'}
        onClick={() => toggle('battle')}
        count={inBattle}
        label="In Battle"
        icon={
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M2 10L10 2M7 2h3v3" />
          </svg>
        }
      />
      <StatButton
        active={activeFilter === 'review'}
        onClick={() => toggle('review')}
        count={awaitingOrders}
        label="Awaiting Orders"
        pulse={awaitingOrders > 0}
        icon={
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
            <polygon points="2,1 10,6 2,11" />
          </svg>
        }
      />
      <StatButton
        active={activeFilter === 'victory'}
        onClick={() => toggle('victory')}
        count={victories}
        label="Victories"
        icon={
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor">
            <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" />
          </svg>
        }
      />
      <StatButton
        active={activeFilter === 'ko'}
        onClick={() => toggle('ko')}
        count={ko}
        label="KO"
        icon={
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="3" y1="3" x2="9" y2="9" />
            <line x1="9" y1="3" x2="3" y2="9" />
          </svg>
        }
      />
      <div className="ml-auto">
        <GilDisplay amount={totalGil} />
      </div>
    </div>
  );
}

function StatButton({
  active,
  onClick,
  count,
  label,
  icon,
  pulse,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  label: string;
  icon: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-[family-name:var(--font-display)] text-[11px] font-semibold uppercase tracking-wider transition-all ${
        active
          ? 'border-electric/40 bg-electric/5 text-electric'
          : 'border-transparent text-text-muted hover:text-text-secondary'
      } ${pulse ? 'animate-atb-ready' : ''}`}
    >
      {icon}
      <span>{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
