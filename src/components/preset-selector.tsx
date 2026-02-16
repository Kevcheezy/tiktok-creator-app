'use client';

import { useState } from 'react';

interface Preset {
  id: string;
  title: string;
  description: string;
  category_affinity: string[];
  virality_notes?: string;
  is_default: boolean;
  is_custom: boolean;
  sort_order: number;
}

interface PresetSelectorProps {
  step: number;
  title: string;
  subtitle: string;
  presets: Preset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  productCategory: string | null;
  readOnly?: boolean;
}

export type { Preset };

export function PresetSelector({
  step,
  title,
  subtitle,
  presets,
  selectedId,
  onSelect,
  customText,
  onCustomTextChange,
  productCategory,
  readOnly,
}: PresetSelectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isCustomMode = customText.length > 0;

  function handleCardClick(presetId: string) {
    if (readOnly) return;
    if (selectedId === presetId) {
      setExpandedId(expandedId === presetId ? null : presetId);
    } else {
      onSelect(presetId);
      onCustomTextChange('');
      setExpandedId(null);
    }
  }

  function handleCustomFocus() {
    if (readOnly) return;
    onSelect(null);
  }

  function isBestMatch(preset: Preset): boolean {
    if (!productCategory) return false;
    const cat = productCategory.toLowerCase();
    return preset.category_affinity.some((a) => cat.includes(a.toLowerCase()) || a.toLowerCase().includes(cat));
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Step header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
          {step}
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric">
          {title}
        </h2>
        <span className="text-xs text-text-muted">&mdash; {subtitle}</span>
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map((preset) => {
          const isSelected = selectedId === preset.id && !isCustomMode;
          const isExpanded = expandedId === preset.id;
          const bestMatch = isBestMatch(preset);

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleCardClick(preset.id)}
              disabled={readOnly}
              className={`group relative rounded-lg border-2 p-3 text-left transition-all ${
                isSelected
                  ? 'border-electric bg-electric/5 ring-1 ring-electric/30'
                  : readOnly
                    ? 'border-border/50 bg-surface-raised opacity-50 cursor-not-allowed'
                    : 'border-border bg-surface-raised hover:border-border-bright hover:bg-surface-overlay'
              }`}
            >
              {/* Best match badge */}
              {bestMatch && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-amber-hot/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-amber-hot">
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                    <polygon points="6,0 7.5,4 12,4.5 8.5,7.5 9.5,12 6,9.5 2.5,12 3.5,7.5 0,4.5 4.5,4" />
                  </svg>
                  Best match
                </span>
              )}

              {/* Title */}
              <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                {preset.title}
                {preset.is_default && (
                  <span className="ml-1 font-normal text-text-muted">(default)</span>
                )}
              </p>

              {/* Description */}
              <p className={`mt-1 text-[11px] leading-relaxed text-text-muted ${isExpanded ? '' : 'line-clamp-2'}`}>
                {preset.description}
              </p>

              {/* Virality notes (expanded only) */}
              {isExpanded && preset.virality_notes && (
                <p className="mt-1.5 text-[10px] italic text-summon">
                  {preset.virality_notes}
                </p>
              )}

              {/* Selection checkmark */}
              {isSelected && (
                <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-electric">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-void" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3.5 8 6.5 11 12.5 5" />
                  </svg>
                </div>
              )}

              {/* Expand hint */}
              {isSelected && !isExpanded && (
                <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[9px] text-text-muted/60">
                  Click again to expand
                </p>
              )}
            </button>
          );
        })}

        {/* Custom override card */}
        <button
          type="button"
          onClick={handleCustomFocus}
          disabled={readOnly}
          className={`rounded-lg border-2 border-dashed p-3 text-left transition-all ${
            isCustomMode
              ? 'border-electric bg-electric/5'
              : readOnly
                ? 'border-border/50 bg-surface-raised opacity-50 cursor-not-allowed'
                : 'border-border-bright bg-surface-raised hover:border-electric/50 hover:bg-surface-overlay'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-text-muted" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-secondary">
              Custom
            </p>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Write your own description
          </p>
        </button>
      </div>

      {/* Custom textarea (visible when custom mode active) */}
      {isCustomMode && (
        <div className="mt-3">
          <textarea
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            disabled={readOnly}
            rows={3}
            placeholder="Describe the scene or interaction in detail..."
            className="block w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric resize-none disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
