'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProductCard } from './product-card';
import type { Product } from './product-card';
import { ConfirmDialog } from './confirm-dialog';

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
              <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-surface-raised" />
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
            {/* Potion icon */}
            <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4h8v4l4 8v8a4 4 0 01-4 4h-8a4 4 0 01-4-4v-8l4-8V4z" />
              <line x1="12" y1="4" x2="20" y2="4" />
              <path d="M10 18h12" opacity="0.5" />
            </svg>
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No items in inventory
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Create a project to analyze your first product.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-flex items-center gap-2 overflow-hidden rounded border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
          >
            <svg viewBox="0 0 8 10" fill="currentColor" className="h-2.5 w-2.5">
              <polygon points="0,0 8,5 0,10" />
            </svg>
            Add Item
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onDelete={(id) => {
            const target = products.find((p) => p.id === id);
            if (target) setDeleteTarget(target);
          }}
        />
      ))}

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
