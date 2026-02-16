'use client';

import { useState } from 'react';
import { GilDisplay } from '../gil-display';
import { PerformanceBadge } from './performance-badge';
import { SCRIPT_TONES } from '@/lib/constants';
import type { AnalyticsRun } from './types';

function formatNum(n: number | null): string {
  if (n === null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function RunRow({
  run,
  onLinkTikTok,
}: {
  run: AnalyticsRun;
  onLinkTikTok: (runId: string, url: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const toneLabel = run.tone
    ? SCRIPT_TONES[run.tone as keyof typeof SCRIPT_TONES]?.label || run.tone
    : null;

  function handleSubmitUrl() {
    const trimmed = urlInput.trim();
    if (trimmed && trimmed.includes('tiktok.com')) {
      onLinkTikTok(run.id, trimmed);
      setShowInput(false);
      setUrlInput('');
    }
  }

  const timeAgo = getTimeAgo(run.created_at);

  return (
    <div className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-raised">
      <div className="flex flex-wrap items-start gap-4">
        {/* Left: Recipe info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-[family-name:var(--font-display)] text-sm font-bold text-text-primary">
              {run.product_data?.product_name || 'Unknown Product'}
            </h4>
            <PerformanceBadge status={run.performance_status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {toneLabel && (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {toneLabel}
              </span>
            )}
            {run.character_name && (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {run.character_name}
              </span>
            )}
            {run.hook_score !== null && (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                Hook: {run.hook_score}/14
              </span>
            )}
            <GilDisplay amount={run.total_cost_usd} className="text-[10px]" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted/60">
              {timeAgo}
            </span>
          </div>
        </div>

        {/* Center: Metrics */}
        <div className="flex items-center gap-4">
          <MetricCell label="Views" value={formatNum(run.views)} />
          <MetricCell label="Sales" value={run.units_sold !== null ? run.units_sold.toString() : '—'} />
          <MetricCell label="Revenue" value={run.gmv_usd !== null ? `$${run.gmv_usd.toFixed(0)}` : '—'} />
          <MetricCell label="ROI" value={run.roi !== null ? `${run.roi.toFixed(1)}x` : '—'} accent={run.roi !== null && run.roi >= 3} />
        </div>

        {/* Right: TikTok link */}
        <div className="flex shrink-0 items-center">
          {run.tiktok_post_url ? (
            <a
              href={run.tiktok_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] text-text-muted transition-colors hover:border-electric/30 hover:text-electric"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3H3v10h10v-3" />
                <path d="M9 2h5v5" />
                <path d="M14 2L7 9" />
              </svg>
              TikTok
            </a>
          ) : showInput ? (
            <div className="flex items-center gap-1">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitUrl()}
                placeholder="https://tiktok.com/..."
                className="h-7 w-48 rounded-lg border border-border bg-surface-raised px-2 font-[family-name:var(--font-mono)] text-[10px] text-text-primary placeholder:text-text-muted/40 focus:border-electric/50 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSubmitUrl}
                className="h-7 rounded-lg bg-electric/10 px-2 font-[family-name:var(--font-display)] text-[10px] font-semibold text-electric hover:bg-electric/20"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => { setShowInput(false); setUrlInput(''); }}
                className="h-7 px-1 text-[10px] text-text-muted hover:text-text-secondary"
              >
                &times;
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 font-[family-name:var(--font-display)] text-[10px] font-semibold text-text-muted transition-colors hover:border-electric/30 hover:text-electric"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              Link TikTok
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={`font-[family-name:var(--font-mono)] text-sm font-bold ${accent ? 'text-lime' : 'text-text-primary'}`}>
        {value}
      </p>
      <p className="font-[family-name:var(--font-display)] text-[9px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
