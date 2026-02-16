'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { KPICards } from './kpi-cards';
import { RunTable } from './run-table';
import { Leaderboard } from './leaderboard';
import { DimensionBreakdown } from './dimension-breakdown';
import { AnalyticsEmpty } from './analytics-empty';
import { USE_MOCK_DATA, generateMockRuns, computeSummary, EMPTY_SUMMARY } from './mock-data';
import type { AnalyticsRun, KPISummary, AnalyticsFilters } from './types';

type Tab = 'runs' | 'leaderboard' | 'breakdown';

const TABS: { key: Tab; label: string }[] = [
  { key: 'runs', label: 'Runs' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'breakdown', label: 'Breakdown' },
];

export function AnalyticsDashboard() {
  const [runs, setRuns] = useState<AnalyticsRun[]>([]);
  const [summary, setSummary] = useState<KPISummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('runs');
  const [filters, setFilters] = useState<AnalyticsFilters>({
    search: '',
    performanceStatus: 'all',
    tone: 'all',
    category: 'all',
  });

  useEffect(() => {
    if (USE_MOCK_DATA) {
      const mockRuns = generateMockRuns(24);
      setRuns(mockRuns);
      setSummary(computeSummary(mockRuns));
      setLoading(false);
      return;
    }

    fetch('/api/analytics/runs')
      .then((res) => (res.ok ? res.json() : { runs: [], summary: EMPTY_SUMMARY }))
      .then((data) => {
        setRuns(data.runs || []);
        setSummary(data.summary || computeSummary(data.runs || []));
      })
      .catch(() => {
        setRuns([]);
        setSummary(EMPTY_SUMMARY);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLinkTikTok = useCallback((runId: string, url: string) => {
    // In mock mode, update local state
    setRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? { ...r, tiktok_post_url: url, performance_status: 'pending' as const }
          : r
      )
    );

    if (!USE_MOCK_DATA) {
      fetch(`/api/analytics/runs/${runId}/link`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktok_post_url: url }),
      }).catch(() => {});
    }
  }, []);

  // Recompute summary when runs change (for mock link updates)
  const liveSummary = useMemo(() => (USE_MOCK_DATA ? computeSummary(runs) : summary), [runs, summary]);

  const hasLinked = runs.some((r) => r.tiktok_post_url);

  if (!loading && runs.length === 0) {
    return <AnalyticsEmpty variant="no-runs" />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards summary={liveSummary} loading={loading} />

      {/* No linked hint */}
      {!loading && !hasLinked && runs.length > 0 && (
        <div className="rounded-lg border border-amber-hot/20 bg-amber-hot/5 px-4 py-3">
          <p className="font-[family-name:var(--font-display)] text-xs text-amber-hot">
            Link your TikTok posts to completed runs to unlock performance tracking, leaderboards, and breakdowns.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-4 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-electric/10 text-electric border border-electric/30'
                : 'border border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'runs' && (
        <RunTable
          runs={runs}
          filters={filters}
          onFiltersChange={setFilters}
          onLinkTikTok={handleLinkTikTok}
        />
      )}
      {activeTab === 'leaderboard' && <Leaderboard runs={runs} loading={loading} />}
      {activeTab === 'breakdown' && <DimensionBreakdown runs={runs} loading={loading} />}
    </div>
  );
}
