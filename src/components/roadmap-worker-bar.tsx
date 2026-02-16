'use client';

import { useState } from 'react';
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

// What each worker owns — shown in legend
const WORKER_SCOPE: Record<string, string> = {
  cloud: 'API routes, agents, workers, pipeline, database, Supabase migrations',
  tifa: 'Pages, components, styling, forms, layout, user interactions',
  barret: 'Logging, deploy, Redis, TLS, CI/CD, cost tracking, config',
  aerith: 'Roadmap, specs, design docs, UX planning, acceptance criteria',
  red_xiii: 'Testing, validation, error handling, guards, security audits',
};

export function WorkerBar({ workers, selected, onSelect }: WorkerBarProps) {
  const [legendOpen, setLegendOpen] = useState(false);

  return (
    <div className="space-y-2">
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
                <div className="mt-0.5 text-[10px] leading-none" style={{ color: w.color }}>
                  {w.role}
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

        {/* Legend toggle */}
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[10px] text-text-muted transition-all hover:border-border-bright hover:text-text-secondary"
          title="Show worker role legend"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="8" cy="8" r="6.5" />
            <line x1="8" y1="7" x2="8" y2="11.5" />
            <circle cx="8" cy="4.8" r="0.5" fill="currentColor" stroke="none" />
          </svg>
          <span className="font-[family-name:var(--font-display)] uppercase tracking-wider">
            {legendOpen ? 'Hide' : 'Legend'}
          </span>
        </button>
      </div>

      {/* Legend panel */}
      {legendOpen && (
        <div className="animate-fade-in-up rounded-xl border border-border bg-surface-raised/60 p-4">
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-[11px] font-bold uppercase tracking-widest text-text-secondary">
            Party Roles
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {workers.map((w) => {
              const spriteChar = WORKER_SPRITE_MAP[w.key] || w.key;
              const scope = WORKER_SCOPE[w.key] || '';
              return (
                <div
                  key={w.key}
                  className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-bg/40 px-3 py-2.5"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    <FF7Sprite character={spriteChar} size="sm" state="idle" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text-primary">
                      {w.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] font-semibold" style={{ color: w.color }}>
                      {w.role}
                    </div>
                    <div className="mt-1 text-[10px] leading-snug text-text-muted">
                      {scope}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
