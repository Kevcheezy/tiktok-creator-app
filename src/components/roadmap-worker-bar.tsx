'use client';

import { FF7Sprite } from './ff7-sprite';

interface WorkerStat {
  key: string;
  name: string;
  color: string;
  role: string;
  tasks: { total: number; backlog: number; in_progress: number; done: number };
  assignments: string[];
}

interface WorkerBarProps {
  workers: WorkerStat[];
  selected: string | null;
  onSelect: (worker: string | null) => void;
}

// Map worker keys to FF7Sprite character keys (pipeline stage keys)
const WORKER_SPRITE_MAP: Record<string, string> = {
  cloud: 'analyzing',
  tifa: 'scripting',
  barret: 'directing',
  aerith: 'broll_planning',
  red_xiii: 'casting',
};

export function WorkerBar({ workers, selected, onSelect }: WorkerBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* All button */}
      <button
        onClick={() => onSelect(null)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
          selected === null
            ? 'border-electric bg-electric/10 text-electric'
            : 'border-border bg-surface-raised text-text-secondary hover:border-border-bright hover:text-text-primary'
        }`}
      >
        <span className="font-[family-name:var(--font-display)] uppercase tracking-wider">All</span>
      </button>

      {workers.map((w) => {
        const isSelected = selected === w.key;
        const hasActive = w.tasks.in_progress > 0;
        const spriteChar = WORKER_SPRITE_MAP[w.key] || w.key;

        return (
          <button
            key={w.key}
            onClick={() => onSelect(isSelected ? null : w.key)}
            className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all ${
              isSelected
                ? 'border-electric bg-electric/10 shadow-[0_0_12px_rgba(0,229,160,0.15)]'
                : 'border-border bg-surface-raised hover:border-border-bright'
            }`}
          >
            <div className={hasActive ? 'animate-materia-pulse' : ''}>
              <FF7Sprite character={spriteChar} size="sm" state={hasActive ? 'attack' : 'idle'} />
            </div>
            <div className="text-left">
              <div className={`text-xs font-medium leading-none ${isSelected ? 'text-electric' : 'text-text-primary'}`}>
                {w.name.split(' ')[0]}
              </div>
              <div className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {w.tasks.total} task{w.tasks.total !== 1 ? 's' : ''}
              </div>
            </div>
            {w.tasks.in_progress > 0 && (
              <span
                className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-[family-name:var(--font-mono)] text-[9px] font-bold"
                style={{ backgroundColor: `${w.color}30`, color: w.color }}
              >
                {w.tasks.in_progress}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
