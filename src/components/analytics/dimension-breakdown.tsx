'use client';

import { useState, useEffect } from 'react';
import { MetricBar } from './metric-bar';

type Dimension = 'tone' | 'category' | 'character';

const DIM_TABS: { key: Dimension; label: string; apiParam: string }[] = [
  { key: 'tone', label: 'Tone', apiParam: 'tone' },
  { key: 'category', label: 'Category', apiParam: 'category' },
  { key: 'character', label: 'Avatar', apiParam: 'influencer' },
];

interface BreakdownRow {
  label: string;
  count: number;
  avg_roi: number;
  total_revenue: number;
  avg_views: number;
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function DimensionBreakdown() {
  const [dimension, setDimension] = useState<Dimension>('tone');
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const tab = DIM_TABS.find((t) => t.key === dimension)!;
    fetch(`/api/analytics/breakdown?dimension=${tab.apiParam}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { groups?: Record<string, unknown>[] } | null) => {
        if (data && Array.isArray(data.groups)) {
          setRows(
            data.groups.map((g) => ({
              label: (g.key as string) || 'Unknown',
              count: (g.count as number) || 0,
              avg_roi: (g.avgRoi as number) || 0,
              total_revenue: (g.totalGmv as number) || 0,
              avg_views: Math.round((g.avgViews as number) || 0),
            }))
          );
        } else {
          setRows([]);
        }
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [dimension]);

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
          <div key={row.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-[family-name:var(--font-display)] text-xs font-bold text-text-primary">
                {row.label}
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
