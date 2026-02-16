import type { KPISummary } from './types';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

interface KPICardDef {
  label: string;
  value: (s: KPISummary) => string;
  accent: string;
  icon: React.ReactNode;
}

const CARDS: KPICardDef[] = [
  {
    label: 'Total Runs',
    value: (s) => s.total_runs.toString(),
    accent: 'text-electric',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="3" height="16" rx="0.5" />
        <rect x="10" y="6" width="3" height="12" rx="0.5" />
        <rect x="16" y="10" width="3" height="8" rx="0.5" />
      </svg>
    ),
  },
  {
    label: 'Total Revenue',
    value: (s) => formatUsd(s.total_revenue_usd),
    accent: 'text-gil',
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5">
        <circle cx="10" cy="10" r="8" fill="#ffc933" stroke="#b8941f" strokeWidth="1" />
        <text x="10" y="13" fill="#8a6d14" fontSize="9" fontWeight="bold" textAnchor="middle">G</text>
      </svg>
    ),
  },
  {
    label: 'Avg ROI',
    value: (s) => s.avg_roi > 0 ? `${s.avg_roi.toFixed(1)}x` : '—',
    accent: 'text-lime',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 5-9" />
        <path d="M14 7h3v3" />
      </svg>
    ),
  },
  {
    label: 'Avg Views',
    value: (s) => s.avg_views > 0 ? formatNumber(s.avg_views) : '—',
    accent: 'text-summon',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 10s3.5-5 8-5 8 5 8 5-3.5 5-8 5-8-5-8-5z" />
        <circle cx="10" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    label: 'Avg CVR',
    value: (s) => s.avg_conversion_rate > 0 ? formatPct(s.avg_conversion_rate) : '—',
    accent: 'text-phoenix',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6" r="4" />
        <path d="M6 18l4-7 4 7" />
        <path d="M8 14h4" />
      </svg>
    ),
  },
  {
    label: 'Top Performer',
    value: (s) => s.top_performer ? `${s.top_performer.name}` : '—',
    accent: 'text-electric',
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="10,2 12.5,7 18,7.5 14,11.5 15,17 10,14 5,17 6,11.5 2,7.5 7.5,7" />
      </svg>
    ),
  },
];

export function KPICards({ summary, loading }: { summary: KPISummary; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-raised"
        >
          <div className={`mb-2 ${card.accent}`}>{card.icon}</div>
          <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {card.label}
          </p>
          {loading ? (
            <div className="mt-1 h-7 w-20 animate-shimmer rounded" />
          ) : (
            <p className="mt-1 font-[family-name:var(--font-mono)] text-xl font-bold text-text-primary">
              {card.value(summary)}
            </p>
          )}
          {card.label === 'Top Performer' && !loading && summary.top_performer && (
            <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] text-gil">
              {formatUsd(summary.top_performer.revenue)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
