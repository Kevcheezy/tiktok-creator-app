'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ErrorBoundary] Unhandled error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-magenta/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-8 w-8 text-magenta"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 className="mt-6 font-[family-name:var(--font-display)] text-xl font-bold text-text-primary">
        Something went wrong
      </h2>

      <p className="mt-2 text-sm text-text-secondary">
        An unexpected error occurred while loading this page.
      </p>

      {error.message && (
        <p className="mt-3 max-w-md rounded-lg border border-border bg-surface-raised px-4 py-2 font-[family-name:var(--font-mono)] text-xs text-text-muted">
          {error.message}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
      >
        Try Again
      </button>
    </main>
  );
}
