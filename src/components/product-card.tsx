'use client';

import Link from 'next/link';
import { StatusBadge } from './status-badge';

export interface Product {
  id: string;
  url: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
  project_count: number;
  created_at: string;
}

interface ProductCardProps {
  product: Product;
  onDelete?: (id: string) => void;
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

/** Map product statuses to the StatusBadge status keys */
const PRODUCT_STATUS_MAP: Record<string, string> = {
  created: 'created',
  analyzing: 'analyzing',
  analyzed: 'completed',
  failed: 'failed',
};

const STATUS_ACCENT: Record<string, string> = {
  created: 'group-hover:border-border-bright',
  analyzing: 'group-hover:border-electric/40',
  analyzed: 'group-hover:border-lime/40',
  failed: 'group-hover:border-magenta/40',
};

export function ProductCard({ product, onDelete }: ProductCardProps) {
  const displayName = product.name || 'Untitled Product';
  const accent = STATUS_ACCENT[product.status] || 'group-hover:border-border-bright';
  const badgeStatus = PRODUCT_STATUS_MAP[product.status] || 'created';

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div
        className={`relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:bg-surface-raised hover:shadow-lg hover:shadow-black/20 ${accent}`}
      >
        {/* Top gradient line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-bright to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Header: image + name/brand */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Product image thumbnail */}
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-border-bright bg-surface-raised">
              {product.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.image_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {/* Package icon placeholder */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-7 w-7 text-text-muted"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2l9 4.5v11L12 22l-9-4.5v-11L12 2z" />
                    <path d="M12 12l9-4.5" />
                    <path d="M12 12v10" />
                    <path d="M12 12L3 7.5" />
                  </svg>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate font-[family-name:var(--font-display)] text-sm font-semibold leading-tight text-text-primary">
                {displayName}
              </h3>
              {product.brand && (
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {product.brand}
                </p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <StatusBadge status={badgeStatus} />
          </div>
        </div>

        {/* Meta: category badge */}
        <div className="mt-4 flex items-center gap-3">
          {product.category && (
            <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
              {product.category}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
            Used in {product.project_count} project{product.project_count !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              {timeAgo(product.created_at)}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(product.id);
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
            )}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5 text-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-text-secondary"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="8" x2="13" y2="8" />
              <polyline points="9 4 13 8 9 12" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
