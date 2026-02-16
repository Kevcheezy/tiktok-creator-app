'use client';

import { useState, useEffect } from 'react';
import { MetricBar } from './metric-bar';

type Metric = 'revenue' | 'views' | 'roi';

const METRIC_TABS: { key: Metric; label: string; sortParam: string }[] = [
  { key: 'revenue', label: 'Revenue', sortParam: 'gmv' },
  { key: 'views', label: 'Views', sortParam: 'views' },
  { key: 'roi', label: 'ROI', sortParam: 'roi' },
];

interface LeaderboardRow {
  id: string;
  name: string;
  tone: string | null;
  value: number;
}

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

function extractValue(row: Record<string, unknown>, metric: Metric): number {
  if (metric === 'revenue') return (row.gmv_usd as number) || 0;
  if (metric === 'views') return (row.views as number) || 0;
  return (row.roi as number) || 0;
}

function extractName(row: Record<string, unknown>): string {
  const run = row.completed_run as Record<string, unknown> | null;
  if (!run) return 'Unknown';
  const pd = run.product_data as Record<string, string> | null;
  return pd?.product_name || (run.influencer_name as string) || 'Unknown';
}

export function Leaderboard() {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [entries, setEntries] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const tab = METRIC_TABS.find((t) => t.key === metric)!;
    fetch(`/api/analytics/leaderboard?sort=${tab.sortParam}&limit=5`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Record<string, unknown>[]) => {
        if (Array.isArray(data)) {
          setEntries(
            data.map((row) => ({
              id: row.id as string,
              name: extractName(row),
              tone: (row.completed_run as Record<string, unknown> | null)?.tone as string | null,
              value: extractValue(row, metric),
            }))
          );
        } else {
          setEntries([]);
        }
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [metric]);

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
