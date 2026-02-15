'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ProductForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create product');
      }

      const product = await res.json();
      router.refresh();
      router.push(`/products/${product.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
          <p className="text-sm text-magenta">{error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="url"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Product URL <span className="text-magenta">*</span>
        </label>
        <input
          type="url"
          id="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.tiktok.com/shop/pdp/..."
          className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />
        <p className="mt-2 text-xs text-text-muted">
          If this URL has already been analyzed, the existing product will be returned.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-lg bg-electric px-4 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(0,240,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
            </svg>
            Analyzing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="8" cy="8" r="5" />
              <path d="M8 5v3l2 1" />
            </svg>
            Analyze Product
          </span>
        )}
      </button>
    </form>
  );
}
