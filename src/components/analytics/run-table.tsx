'use client';

import { useState, useMemo } from 'react';
import { RunRow } from './run-row';
import type { AnalyticsRun, AnalyticsFilters, PerformanceStatus } from './types';

const STATUS_PILLS: { label: string; key: PerformanceStatus | 'all' }[] = [
  { label: 'All', key: 'all' },
  { label: 'Viral', key: 'viral' },
  { label: 'Converting', key: 'converting' },
  { label: 'Underperforming', key: 'underperforming' },
  { label: 'Unlinked', key: 'unlinked' },
];

const PAGE_SIZE = 12;

export function RunTable({
  runs,
  filters,
  onFiltersChange,
  onLinkTikTok,
}: {
  runs: AnalyticsRun[];
  filters: AnalyticsFilters;
  onFiltersChange: (f: AnalyticsFilters) => void;
  onLinkTikTok: (runId: string, url: string) => void;
}) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = runs;

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.product_data?.product_name?.toLowerCase().includes(q) ||
          r.tone?.toLowerCase().includes(q) ||
          r.character_name?.toLowerCase().includes(q)
      );
    }

    // Performance status
    if (filters.performanceStatus !== 'all') {
      result = result.filter((r) => r.performance_status === filters.performanceStatus);
    }

    // Tone
    if (filters.tone !== 'all') {
      result = result.filter((r) => r.tone === filters.tone);
    }

    // Category
    if (filters.category !== 'all') {
      result = result.filter((r) => r.product_data?.category === filters.category);
    }

    return result;
  }, [runs, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Collect unique tones and categories for dropdown filters
  const tones = [...new Set(runs.map((r) => r.tone).filter(Boolean))] as string[];
  const categories = [...new Set(runs.map((r) => r.product_data?.category).filter(Boolean))] as string[];

  // Count per status for badge display
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: runs.length };
    for (const r of runs) {
      counts[r.performance_status] = (counts[r.performance_status] || 0) + 1;
    }
    return counts;
  }, [runs]);

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 16 16" fill="none" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => { onFiltersChange({ ...filters, search: e.target.value }); setPage(1); }}
            placeholder="Search runs..."
            className="h-8 w-52 rounded-lg border border-border bg-surface-raised pl-8 pr-3 font-[family-name:var(--font-mono)] text-xs text-text-primary placeholder:text-text-muted/50 focus:border-electric/40 focus:outline-none"
          />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1">
          {STATUS_PILLS.map((pill) => {
            const active = filters.performanceStatus === pill.key;
            const count = statusCounts[pill.key] || 0;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => { onFiltersChange({ ...filters, performanceStatus: pill.key }); setPage(1); }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-[family-name:var(--font-display)] text-[11px] font-semibold transition-all ${
                  active
                    ? 'border-electric/30 bg-electric/10 text-electric'
                    : 'border-border bg-surface text-text-muted hover:border-border hover:text-text-secondary'
                }`}
              >
                {pill.label}
                <span className={`font-[family-name:var(--font-mono)] text-[10px] ${active ? 'text-electric/70' : 'text-text-muted/60'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tone filter */}
        {tones.length > 1 && (
          <select
            value={filters.tone}
            onChange={(e) => { onFiltersChange({ ...filters, tone: e.target.value }); setPage(1); }}
            className="h-8 rounded-lg border border-border bg-surface-raised px-2 font-[family-name:var(--font-display)] text-[11px] text-text-secondary focus:border-electric/40 focus:outline-none"
          >
            <option value="all">All Tones</option>
            {tones.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Category filter */}
        {categories.length > 1 && (
          <select
            value={filters.category}
            onChange={(e) => { onFiltersChange({ ...filters, category: e.target.value }); setPage(1); }}
            className="h-8 rounded-lg border border-border bg-surface-raised px-2 font-[family-name:var(--font-display)] text-[11px] text-text-secondary focus:border-electric/40 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Result count */}
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
          {filtered.length} run{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Run rows */}
      <div className="stagger-children space-y-2">
        {paged.map((run) => (
          <RunRow key={run.id} run={run} onLinkTikTok={onLinkTikTok} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="rounded-lg border border-border px-3 py-1 font-[family-name:var(--font-mono)] text-xs text-text-muted transition-colors hover:text-text-secondary disabled:opacity-30"
          >
            Prev
          </button>
          <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            className="rounded-lg border border-border px-3 py-1 font-[family-name:var(--font-mono)] text-xs text-text-muted transition-colors hover:text-text-secondary disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
