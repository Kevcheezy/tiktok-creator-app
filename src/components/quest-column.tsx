'use client';

import { FF7Sprite } from './ff7-sprite';

interface QuestColumnProps {
  name: string;
  subtitle: string;
  character: string;
  color: string;
  count: number;
  children: React.ReactNode;
}

export function QuestColumn({ name, subtitle, character, color, count, children }: QuestColumnProps) {
  return (
    <div className="flex min-w-[240px] flex-shrink-0 flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <FF7Sprite character={character} state="idle" size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
            {name}
          </h3>
          <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
            {subtitle}
          </p>
        </div>
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-[family-name:var(--font-mono)] text-[10px] font-bold"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {count}
        </span>
      </div>

      {/* Accent bar */}
      <div className="mb-3 h-[3px] rounded-full" style={{ backgroundColor: `${color}40` }} />

      {/* Card container */}
      <div className="stagger-children flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {count === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
              No encounters
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
