'use client';

import { useState, useMemo } from 'react';
import { MetricBar } from './metric-bar';
import { SCRIPT_TONES } from '@/lib/constants';
import type { AnalyticsRun, DimensionRow } from './types';

type Dimension = 'tone' | 'category' | 'character';

const DIM_TABS: { key: Dimension; label: string }[] = [
  { key: 'tone', label: 'Tone' },
  { key: 'category', label: 'Category' },
  { key: 'character', label: 'Avatar' },
];

function getDimensionValue(run: AnalyticsRun, dim: Dimension): string | null {
  if (dim === 'tone') return run.tone;
  if (dim === 'category') return run.product_data?.category || null;
  return run.character_name;
}

function getDimensionLabel(dim: Dimension, value: string): string {
  if (dim === 'tone') {
    return SCRIPT_TONES[value as keyof typeof SCRIPT_TONES]?.label || value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function DimensionBreakdown({ runs, loading }: { runs: AnalyticsRun[]; loading: boolean }) {
  const [dimension, setDimension] = useState<Dimension>('tone');

  const rows = useMemo(() => {
    const linked = runs.filter((r) => r.views !== null);
    if (linked.length === 0) return [];

    const groups = new Map<string, AnalyticsRun[]>();
    for (const run of linked) {
      const key = getDimensionValue(run, dimension);
      if (!key) continue;
      const arr = groups.get(key) || [];
      arr.push(run);
      groups.set(key, arr);
    }

    const result: DimensionRow[] = [];
    for (const [key, group] of groups) {
      const totalRev = group.reduce((s, r) => s + (r.gmv_usd || 0), 0);
      const avgRoi = group.reduce((s, r) => s + (r.roi || 0), 0) / group.length;
      const avgViews = group.reduce((s, r) => s + (r.views || 0), 0) / group.length;
      result.push({
        dimension: getDimensionLabel(dimension, key),
        count: group.length,
        avg_roi: parseFloat(avgRoi.toFixed(2)),
        total_revenue: totalRev,
        avg_views: Math.round(avgViews),
      });
    }

    return result.sort((a, b) => b.total_revenue - a.total_revenue);
  }, [runs, dimension]);

  const maxRevenue = rows.length > 0 ? Math.max(...rows.map((r) => r.total_revenue)) : 1;
  const maxRoi = rows.length > 0 ? Math.max(...rows.map((r) => r.avg_roi)) : 1;

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-shimmer rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">
          No performance data to break down
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dimension toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5 w-fit">
        {DIM_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setDimension(tab.key)}
            className={`rounded-md px-3 py-1 font-[family-name:var(--font-display)] text-xs font-semibold transition-all ${
              dimension === tab.key
                ? 'bg-electric/10 text-electric border border-electric/30'
                : 'border border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.dimension} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-[family-name:var(--font-display)] text-xs font-bold text-text-primary">
                {row.dimension}
              </h4>
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {row.count} run{row.count !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1.5">
              <MetricBar
                label="Revenue"
                value={row.total_revenue}
                maxValue={maxRevenue}
                color="bg-gil"
                formattedValue={formatUsd(row.total_revenue)}
              />
              <MetricBar
                label="Avg ROI"
                value={row.avg_roi}
                maxValue={maxRoi}
                color="bg-lime"
                formattedValue={`${row.avg_roi.toFixed(1)}x`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
