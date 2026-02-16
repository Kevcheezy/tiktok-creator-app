'use client';

import { useState, useMemo } from 'react';
import { MetricBar } from './metric-bar';
import type { AnalyticsRun } from './types';

type Metric = 'revenue' | 'views' | 'roi';

const METRIC_TABS: { key: Metric; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'views', label: 'Views' },
  { key: 'roi', label: 'ROI' },
];

function formatValue(metric: Metric, value: number): string {
  if (metric === 'revenue') {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (metric === 'views') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
  }
  return `${value.toFixed(1)}x`;
}

function getBarColor(metric: Metric): string {
  if (metric === 'revenue') return 'bg-gil';
  if (metric === 'views') return 'bg-summon';
  return 'bg-lime';
}

export function Leaderboard({ runs, loading }: { runs: AnalyticsRun[]; loading: boolean }) {
  const [metric, setMetric] = useState<Metric>('revenue');

  const entries = useMemo(() => {
    const linked = runs.filter((r) => r.views !== null);
    if (linked.length === 0) return [];

    const getValue = (r: AnalyticsRun): number => {
      if (metric === 'revenue') return r.gmv_usd || 0;
      if (metric === 'views') return r.views || 0;
      return r.roi || 0;
    };

    return [...linked]
      .sort((a, b) => getValue(b) - getValue(a))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        name: r.product_data?.product_name || 'Unknown',
        tone: r.tone,
        value: getValue(r),
      }));
  }, [runs, metric]);

  const maxValue = entries.length > 0 ? entries[0].value : 1;

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 animate-shimmer rounded-lg" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">
          No performance data yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metric toggle */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5 w-fit">
        {METRIC_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMetric(tab.key)}
            className={`rounded-md px-3 py-1 font-[family-name:var(--font-display)] text-xs font-semibold transition-all ${
              metric === tab.key
                ? 'bg-electric/10 text-electric border border-electric/30'
                : 'border border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ranked bars */}
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-[10px] font-bold ${
              i === 0 ? 'bg-gil/20 text-gil' : 'bg-surface-overlay text-text-muted'
            }`}>
              {i + 1}
            </span>
            <div className="flex-1">
              <MetricBar
                label={entry.name}
                value={entry.value}
                maxValue={maxValue}
                color={getBarColor(metric)}
                formattedValue={formatValue(metric, entry.value)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
