'use client';

import { useState } from 'react';

interface AssetCardProps {
  asset: {
    id: string;
    type: string;
    url: string | null;
    status: string;
    provider: string | null;
    cost_usd: string | null;
    grade: string | null;
    metadata: Record<string, unknown> | null;
    scene: { segment_index: number; section: string } | null;
  };
  showGrade?: boolean;
  compact?: boolean;
  onGrade?: (assetId: string, grade: string) => void;
  onReject?: (assetId: string) => void;
  onRegenerate?: (assetId: string) => void;
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  keyframe_start: { label: 'Start', color: 'bg-electric/10 text-electric border-electric/30' },
  keyframe_end: { label: 'End', color: 'bg-electric/10 text-electric border-electric/30' },
  video: { label: 'Video', color: 'bg-magenta/10 text-magenta border-magenta/30' },
  audio: { label: 'Audio', color: 'bg-lime/10 text-lime border-lime/30' },
};

const GRADES = [
  { value: 'S', color: 'bg-lime/10 text-lime border-lime/30 hover:bg-lime/20' },
  { value: 'A', color: 'bg-electric/10 text-electric border-electric/30 hover:bg-electric/20' },
  { value: 'B', color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30 hover:bg-amber-hot/20' },
  { value: 'F', color: 'bg-magenta/10 text-magenta border-magenta/30 hover:bg-magenta/20' },
];

export function AssetCard({ asset, showGrade, compact, onGrade, onReject, onRegenerate }: AssetCardProps) {
  const [grading, setGrading] = useState(false);
  const badge = TYPE_BADGES[asset.type] || { label: asset.type, color: 'bg-surface-overlay text-text-muted border-border' };
  const isKeyframe = asset.type.startsWith('keyframe');

  async function handleGrade(grade: string) {
    setGrading(true);
    try {
      onGrade?.(asset.id, grade);
    } finally {
      setGrading(false);
    }
  }

  if (asset.status === 'generating') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? (compact ? 'aspect-[9/16]' : 'aspect-[9/16]') : 'h-24'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Generating...
            </span>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'failed') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-magenta/30 bg-magenta/5">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-6 w-6 text-magenta" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-magenta">
              Failed
            </span>
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(asset.id)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-magenta/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-magenta transition-all hover:bg-magenta/20"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 2v5h5" />
                  <path d="M3.5 10a5 5 0 109-2.3" />
                </svg>
                Regenerate
              </button>
            )}
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'rejected') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-hot/30 bg-amber-hot/5">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-6 w-6 text-amber-hot" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-amber-hot">
              Rejected
            </span>
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(asset.id)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-hot/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-amber-hot transition-all hover:bg-amber-hot/20"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 2v5h5" />
                  <path d="M3.5 10a5 5 0 109-2.3" />
                </svg>
                Regenerate
              </button>
            )}
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface group">
      {isKeyframe && asset.url && (
        <img
          src={asset.url}
          alt={`${asset.type} keyframe`}
          className="aspect-[9/16] w-full rounded-t-xl object-cover"
        />
      )}

      {asset.type === 'video' && asset.url && (
        <video
          src={asset.url}
          controls
          className="aspect-[9/16] w-full rounded-t-xl object-cover"
        />
      )}

      {asset.type === 'audio' && (
        <div className="flex h-24 items-center justify-center px-4">
          {asset.url ? (
            <audio src={asset.url} controls className="w-full" />
          ) : (
            <span className="text-xs text-text-muted">No audio URL</span>
          )}
        </div>
      )}

      {!asset.url && asset.status === 'completed' && !['audio'].includes(asset.type) && (
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <span className="text-xs text-text-muted">No URL available</span>
        </div>
      )}

      <div className="absolute left-2 top-2">
        <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {asset.cost_usd && (
        <div className="absolute right-2 top-2">
          <span className="inline-flex rounded-md bg-void/70 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] text-text-muted backdrop-blur-sm">
            ${parseFloat(asset.cost_usd).toFixed(4)}
          </span>
        </div>
      )}

      {/* Action buttons: reject + regenerate (shown on hover for completed assets) */}
      {asset.status === 'completed' && (onReject || onRegenerate) && (
        <div className="absolute right-2 bottom-14 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onReject && (
            <button
              type="button"
              onClick={() => onReject(asset.id)}
              title="Reject asset"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-magenta/20 hover:text-magenta"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(asset.id)}
              title="Regenerate asset"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-electric/20 hover:text-electric"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 2v5h5" />
                <path d="M3.5 10a5 5 0 109-2.3" />
              </svg>
            </button>
          )}
        </div>
      )}

      {showGrade && (
        <div className="border-t border-border p-2">
          <div className="flex gap-1">
            {GRADES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => handleGrade(g.value)}
                disabled={grading}
                className={`flex h-7 w-7 items-center justify-center rounded-md border font-[family-name:var(--font-display)] text-[10px] font-bold transition-all ${
                  asset.grade === g.value
                    ? `${g.color} ring-1 ring-current`
                    : 'border-border bg-surface text-text-muted hover:border-border-bright hover:text-text-secondary'
                }`}
              >
                {g.value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
