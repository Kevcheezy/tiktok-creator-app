'use client';

import { useState, useEffect, useCallback } from 'react';
import { KPICards } from './kpi-cards';
import { RunTable } from './run-table';
import { Leaderboard } from './leaderboard';
import { DimensionBreakdown } from './dimension-breakdown';
import { AnalyticsEmpty } from './analytics-empty';
import { generateMockRuns, computeSummary, EMPTY_SUMMARY } from './mock-data';
import type { KPISummary, AnalyticsFilters } from './types';

type Tab = 'runs' | 'leaderboard' | 'breakdown';

const TABS: { key: Tab; label: string }[] = [
  { key: 'runs', label: 'Runs' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'breakdown', label: 'Breakdown' },
];

/** Map camelCase dashboard API response to snake_case KPISummary */
function mapDashboardToSummary(data: Record<string, unknown>): KPISummary {
  const trackedRuns = (data.trackedRuns as number) || 0;
  const totalViews = (data.totalViews as number) || 0;

  return {
    total_runs: (data.totalRuns as number) || 0,
    total_revenue_usd: (data.totalRevenue as number) || 0,
    avg_roi: (data.avgRoi as number) || 0,
    avg_views: trackedRuns > 0 ? Math.round(totalViews / trackedRuns) : 0,
    avg_conversion_rate: 0, // Dashboard API doesn't return this; computed from breakdown if needed
    top_performer: data.bestPerformer
      ? {
          id: (data.bestPerformer as Record<string, unknown>).id as string,
          name: `#${((data.bestPerformer as Record<string, unknown>).project_id as string || '').slice(0, 8)}`,
          revenue: (data.bestPerformer as Record<string, unknown>).roi as number || 0,
        }
      : null,
  };
}

export function AnalyticsDashboard() {
  const [summary, setSummary] = useState<KPISummary>(EMPTY_SUMMARY);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('runs');
  const [filters, setFilters] = useState<AnalyticsFilters>({
    search: '',
    performanceStatus: 'all',
    tone: 'all',
    category: 'all',
  });

  // Fetch KPI summary from dashboard API
  useEffect(() => {
    fetch('/api/analytics/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) {
          const mapped = mapDashboardToSummary(data);
          setSummary(mapped);
          setHasData(mapped.total_runs > 0);
        } else {
          setHasData(false);
        }
      })
      .catch(() => {
        setHasData(false);
      })
      .finally(() => setKpiLoading(false));
  }, []);

  // RunTable still uses mock data (no /api/analytics/runs endpoint yet)
  const [mockRuns] = useState(() => generateMockRuns(24));
  const mockSummary = computeSummary(mockRuns);

  const handleLinkTikTok = useCallback((_runId: string, _url: string) => {
    // TODO: Wire to POST /api/projects/[id]/performance when runs API exists
  }, []);

  if (hasData === false && !kpiLoading) {
    return <AnalyticsEmpty variant="no-runs" />;
  }

  // Use live summary for KPI cards, mock data for runs tab
  const displaySummary = hasData ? summary : mockSummary;

  return (
    <div className="space-y-6">
      {/* KPI Cards — live from /api/analytics/dashboard */}
      <KPICards summary={displaySummary} loading={kpiLoading} />

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
          runs={mockRuns}
          filters={filters}
          onFiltersChange={setFilters}
          onLinkTikTok={handleLinkTikTok}
        />
      )}
      {activeTab === 'leaderboard' && <Leaderboard />}
      {activeTab === 'breakdown' && <DimensionBreakdown />}
    </div>
  );
}
