'use client';

import { SCRIPT_TONES } from '@/lib/constants';

interface ToneSelectorProps {
  value: string;
  onChange: (tone: string) => void;
  compact?: boolean;
}

export function ToneSelector({ value, onChange, compact = false }: ToneSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {Object.entries(SCRIPT_TONES).map(([key, tone]) => (
        <div key={key} className="group relative flex-shrink-0">
          <button
            type="button"
            onClick={() => onChange(key)}
            className={`whitespace-nowrap rounded-full border font-[family-name:var(--font-display)] transition-all ${
              compact
                ? 'px-2.5 py-1 text-[11px] font-medium'
                : 'px-3.5 py-1.5 text-xs font-semibold'
            } ${
              value === key
                ? 'border-electric/30 bg-electric/10 text-electric'
                : 'border-border bg-surface text-text-muted hover:border-border-bright hover:text-text-secondary'
            }`}
          >
            {tone.label}
          </button>

          {/* Tooltip */}
          <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface-raised p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <p className="mb-1.5 text-xs leading-relaxed text-text-secondary">
              <span className="font-[family-name:var(--font-display)] font-semibold text-text-primary">
                Psychology:
              </span>{' '}
              {tone.psychology}
            </p>
            <p className="text-xs leading-relaxed text-text-secondary">
              <span className="font-[family-name:var(--font-display)] font-semibold text-text-primary">
                Best for:
              </span>{' '}
              {tone.bestFor}
            </p>
            {/* Tooltip arrow */}
            <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-border bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}
