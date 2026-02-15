'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from './confirm-dialog';

interface Influencer {
  id: string;
  name: string;
  persona: string | null;
  image_url: string | null;
  status: string;
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

export function InfluencerList() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Influencer | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/influencers/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setInfluencers((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  useEffect(() => {
    fetch('/api/influencers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setInfluencers(data);
        setLoading(false);
      })
      .catch(() => {
        setInfluencers([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-shimmer rounded-xl border border-border bg-surface p-5"
          >
            {/* Avatar skeleton */}
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 flex-shrink-0 rounded-full bg-surface-raised" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-surface-raised" />
                <div className="h-3 w-1/2 rounded bg-surface-raised" />
              </div>
            </div>
            {/* Persona skeleton */}
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-surface-raised" />
              <div className="h-3 w-3/4 rounded bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (influencers.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border-bright bg-surface/50 px-8 py-20 text-center">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-magenta/5 blur-3xl" />
        </div>

        <div className="relative">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg
              viewBox="0 0 32 32"
              fill="none"
              className="h-8 w-8 text-text-muted"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="16" cy="12" r="5" />
              <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10" />
            </svg>
          </div>

          <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            No influencers yet
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Add your first influencer persona with a reference photo.
          </p>
          <Link
            href="/influencers/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Add First Influencer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {influencers.map((influencer) => (
        <Link
          key={influencer.id}
          href={`/influencers/${influencer.id}`}
          className="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:bg-surface-raised hover:shadow-lg hover:shadow-black/20 hover:border-magenta/40"
        >
          {/* Top gradient line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-bright to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

          {/* Header with avatar */}
          <div className="flex items-center gap-4">
            {/* Avatar / thumbnail */}
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-border-bright bg-surface-raised">
              {influencer.image_url ? (
                <img
                  src={influencer.image_url}
                  alt={influencer.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 text-text-muted"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="9" r="4" />
                    <path d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8" />
                  </svg>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate font-[family-name:var(--font-display)] text-sm font-semibold leading-tight text-text-primary">
                {influencer.name}
              </h3>
              <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                {timeAgo(influencer.created_at)}
              </p>
            </div>
          </div>

          {/* Persona */}
          {influencer.persona && (
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">
              {influencer.persona}
            </p>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
              {influencer.status}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDeleteTarget(influencer);
              }}
              className="rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-magenta/10 hover:text-magenta group-hover:opacity-100"
              title="Delete influencer"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4h12" />
                <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
                <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
              </svg>
            </button>
          </div>
        </Link>
      ))}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Influencer"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
