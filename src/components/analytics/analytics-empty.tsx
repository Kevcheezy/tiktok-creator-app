import Link from 'next/link';

export function AnalyticsEmpty({ variant }: { variant: 'no-runs' | 'no-linked' }) {
  return (
    <div className="relative rounded-xl border-2 border-dashed border-border p-12 text-center">
      {/* Decorative blur blob */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-32 w-32 rounded-full bg-magenta/5 blur-3xl" />
      </div>

      <div className="relative">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-raised">
          {variant === 'no-runs' ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7V5a4 4 0 018 0v2" />
              <circle cx="12" cy="14" r="1.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          )}
        </div>

        <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
          {variant === 'no-runs' ? 'No runs in the archive' : 'No TikTok posts linked'}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
          {variant === 'no-runs'
            ? 'Complete a video and archive it to start tracking performance.'
            : 'Link your TikTok post URLs to completed runs to start tracking engagement and revenue.'}
        </p>

        {variant === 'no-runs' && (
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10"
          >
            Start an Encounter
          </Link>
        )}
      </div>
    </div>
  );
}
