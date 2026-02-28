'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from './confirm-dialog';

interface TranscriptSegment {
  index: number;
  section: string;
  text: string;
  start_time: number;
  end_time: number;
}

interface SegmentScores {
  hook: Record<string, number>;
  problem: Record<string, number>;
  solution: Record<string, number>;
  cta: Record<string, number>;
}

interface StylePreset {
  id: string;
  name: string;
  video_url: string | null;
  status: 'analyzing' | 'ready' | 'failed';
  categories: string[];
  total_score: number | null;
  transcript: {
    full_text: string;
    segments: TranscriptSegment[];
  } | null;
  segment_scores: SegmentScores | null;
  patterns: {
    hook_technique: string;
    energy_arc: Record<string, unknown>;
    product_integration_style: string;
    cta_formula: string;
    pacing: string;
  } | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: StylePreset['status'] }) {
  const config = {
    analyzing: {
      classes: 'bg-electric/15 text-electric animate-pulse',
      label: 'Analyzing',
    },
    ready: {
      classes: 'bg-lime/15 text-lime',
      label: 'Ready',
    },
    failed: {
      classes: 'bg-magenta/15 text-magenta',
      label: 'Failed',
    },
  };

  const { classes, label } = config[status] || config.analyzing;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-wider ${classes}`}
    >
      {label}
    </span>
  );
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;

  const maxScore = 44;
  const pct = Math.min((score / maxScore) * 100, 100);
  const color =
    pct >= 75 ? 'text-lime' : pct >= 50 ? 'text-gil' : 'text-text-muted';
  const barColor =
    pct >= 75
      ? 'bg-lime/40'
      : pct >= 50
        ? 'bg-gil/40'
        : 'bg-text-muted/20';

  return (
    <div className="flex items-center gap-2">
      <span
        className={`font-[family-name:var(--font-mono)] text-lg font-bold ${color}`}
      >
        {score}
      </span>
      <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
        /44
      </span>
      <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  onDelete,
}: {
  preset: StylePreset;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:bg-surface-raised hover:shadow-lg hover:shadow-black/20 hover:border-summon/40">
      {/* Top gradient line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-bright to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left"
          >
            <h3 className="truncate font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
              {preset.name}
            </h3>
          </button>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={preset.status} />
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              {timeAgo(preset.created_at)}
            </span>
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(preset.id);
          }}
          className="rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-magenta/10 hover:text-magenta group-hover:opacity-100"
          title="Delete preset"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="h-3.5 w-3.5"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4h12" />
            <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
            <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
          </svg>
        </button>
      </div>

      {/* Score */}
      {preset.status === 'ready' && (
        <div className="mt-3">
          <ScoreDisplay score={preset.total_score} />
        </div>
      )}

      {/* Error message for failed */}
      {preset.status === 'failed' && preset.error_message && (
        <p className="mt-3 line-clamp-2 rounded-md border border-magenta/30 bg-magenta/10 px-3 py-2 text-xs text-magenta">
          {preset.error_message}
        </p>
      )}

      {/* Categories */}
      {preset.categories && preset.categories.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {preset.categories.map((cat) => (
            <span
              key={cat}
              className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-secondary"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Patterns preview (ready only) */}
      {preset.status === 'ready' && preset.patterns && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-electric">
            {preset.patterns.hook_technique.replace(/_/g, ' ')}
          </span>
          <span className="rounded-full bg-summon/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-summon">
            {preset.patterns.pacing.replace(/_/g, ' ')}
          </span>
        </div>
      )}

      {/* Expanded detail section */}
      {expanded && preset.status === 'ready' && preset.segment_scores && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {/* Segment scores overview */}
          {(['hook', 'problem', 'solution', 'cta'] as const).map(
            (segment) => {
              const scores = preset.segment_scores?.[segment];
              if (!scores) return null;
              const total = scores.total ?? 0;
              const maxes: Record<string, number> = {
                hook: 14,
                problem: 10,
                solution: 10,
                cta: 10,
              };
              const maxScore = maxes[segment];

              return (
                <div key={segment}>
                  <div className="flex items-center justify-between">
                    <span className="font-[family-name:var(--font-display)] text-xs font-semibold capitalize text-text-primary">
                      {segment === 'cta' ? 'CTA' : segment}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                      {total}/{maxScore}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-0.5">
                    {Object.entries(scores)
                      .filter(([key]) => key !== 'total')
                      .map(([key, value]) => (
                        <div
                          key={key}
                          title={`${key.replace(/_/g, ' ')}: ${value}`}
                          className={`h-2 flex-1 rounded-sm ${
                            value === 2
                              ? 'bg-lime'
                              : value === 1
                                ? 'bg-gil'
                                : 'bg-surface-raised'
                          }`}
                        />
                      ))}
                  </div>
                </div>
              );
            },
          )}

          {/* Transcript preview */}
          {preset.transcript?.full_text && (
            <div>
              <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                Transcript
              </span>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-text-secondary">
                {preset.transcript.full_text}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Expand hint */}
      {preset.status === 'ready' && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1 font-[family-name:var(--font-mono)] text-[10px] text-text-muted transition-colors hover:text-text-secondary"
        >
          {expanded ? 'Collapse' : 'Expand details'}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function PresetList() {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<StylePreset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/style-presets/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPresets((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const data = await res
          .json()
          .catch(() => ({ error: 'Failed to delete preset' }));
        setDeleteError(data.error || 'Failed to delete preset');
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError('Failed to delete preset');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    fetch('/api/style-presets')
      .then((res) => (res.ok ? res.json() : { presets: [] }))
      .then((data) => {
        setPresets(data.presets || []);
        setLoading(false);
      })
      .catch(() => {
        setPresets([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-shimmer rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 rounded bg-surface-raised" />
                <div className="h-3 w-1/3 rounded bg-surface-raised" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-surface-raised" />
              <div className="h-3 w-3/4 rounded bg-surface-raised" />
            </div>
            <div className="mt-3 flex gap-1.5">
              <div className="h-4 w-16 rounded-full bg-surface-raised" />
              <div className="h-4 w-12 rounded-full bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-bright bg-surface/50 px-8 py-20 text-center">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-summon/5 blur-3xl" />
        </div>

        <div className="relative">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="h-8 w-8 text-text-muted"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="16,2 20,12 30,12 22,18 25,28 16,22 7,28 10,18 2,12 12,12" />
            </svg>
          </div>

          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No style presets yet
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Analyze a winning video to create your first preset.
          </p>
          <Link
            href="/presets/new"
            className="mt-6 inline-flex items-center gap-2 overflow-hidden rounded border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
          >
            <svg
              viewBox="0 0 8 10"
              fill="currentColor"
              className="h-2.5 w-2.5"
            >
              <polygon points="0,0 8,5 0,10" />
            </svg>
            Analyze Video
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Delete error banner */}
      {deleteError && (
        <div className="col-span-full flex items-center justify-between rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
          <p className="text-sm text-magenta">{deleteError}</p>
          <button
            onClick={() => setDeleteError(null)}
            className="ml-4 text-sm text-magenta/60 hover:text-magenta"
          >
            Dismiss
          </button>
        </div>
      )}

      {presets.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          onDelete={(id) => {
            const target = presets.find((p) => p.id === id);
            if (target) setDeleteTarget(target);
          }}
        />
      ))}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Preset"
        description={`Are you sure you want to delete "${deleteTarget?.name || 'this preset'}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        loading={deleting}
      />
    </div>
  );
}
