'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from './confirm-dialog';

interface Product {
  id: string;
  url: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
  project_count: number;
  created_at: string | null;
}

function timeAgo(date: string | null): string {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; pulse?: boolean }> = {
  analyzed: { bg: 'bg-lime/10', text: 'text-lime' },
  analyzing: { bg: 'bg-electric/10', text: 'text-electric', pulse: true },
  created: { bg: 'bg-surface-overlay', text: 'text-text-muted' },
  failed: { bg: 'bg-magenta/10', text: 'text-magenta' },
};

export function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete');
      }
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-shimmer rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-surface-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-surface-raised" />
                <div className="h-3 w-1/2 rounded bg-surface-raised" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-surface-raised" />
              <div className="h-3 w-3/4 rounded bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-bright bg-surface/50 px-8 py-20 text-center">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric/5 blur-3xl" />
        </div>
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="24" height="24" rx="4" />
              <path d="M4 12h24" />
              <path d="M10 18h4" />
              <path d="M10 22h8" />
            </svg>
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No products yet
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Add a product URL to analyze it once and reuse across projects.
          </p>
          <Link
            href="/products/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Add First Product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const style = STATUS_STYLES[product.status] || STATUS_STYLES.created;
        return (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:bg-surface-raised hover:shadow-lg hover:shadow-black/20 hover:border-electric/40"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-bright to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="flex items-center gap-4">
              {/* Product image */}
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-border-bright bg-surface-raised">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt={product.name || 'Product'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-[family-name:var(--font-display)] text-sm font-semibold leading-tight text-text-primary">
                  {product.name || 'Untitled Product'}
                </h3>
                {product.brand && (
                  <p className="mt-0.5 truncate text-xs text-text-muted">{product.brand}</p>
                )}
              </div>
            </div>

            {/* Category + meta */}
            <div className="mt-3 flex items-center gap-2">
              {product.category && (
                <span className="inline-flex rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-electric">
                  {product.category}
                </span>
              )}
              {product.project_count > 0 && (
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                  {product.project_count} project{product.project_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] ${style.bg} ${style.text}`}>
                  {style.pulse && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  )}
                  {product.status}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                  {timeAgo(product.created_at)}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteTarget(product);
                }}
                className="rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-magenta/10 hover:text-magenta group-hover:opacity-100"
                title="Delete product"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12" />
                  <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
                  <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
                </svg>
              </button>
            </div>
          </Link>
        );
      })}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        description={
          deleteError
            ? deleteError
            : `Are you sure you want to delete "${deleteTarget?.name || 'this product'}"? This action cannot be undone.`
        }
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        loading={deleting}
      />
    </div>
  );
}
