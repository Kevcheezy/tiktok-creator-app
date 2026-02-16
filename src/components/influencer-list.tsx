'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './confirm-dialog';

interface Influencer {
  id: string;
  name: string;
  persona: string | null;
  image_url: string | null;
  status: string;
  created_at: string | null;
  voice_id: string | null;
  voice_preview_url: string | null;
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
  const router = useRouter();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Influencer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const sharedAudioRef = useRef<HTMLAudioElement | null>(null);

  function handleVoicePreview(e: React.MouseEvent, influencer: Influencer) {
    e.stopPropagation();
    if (!influencer.voice_preview_url) return;

    // If already playing this one, stop it
    if (playingVoiceId === influencer.id && sharedAudioRef.current) {
      sharedAudioRef.current.pause();
      sharedAudioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }

    // Create or reuse audio element
    if (!sharedAudioRef.current) {
      sharedAudioRef.current = new Audio();
      sharedAudioRef.current.addEventListener('ended', () => setPlayingVoiceId(null));
    }

    sharedAudioRef.current.pause();
    sharedAudioRef.current.src = influencer.voice_preview_url;
    sharedAudioRef.current.play().catch(() => setPlayingVoiceId(null));
    setPlayingVoiceId(influencer.id);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/influencers/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setInfluencers((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to delete influencer' }));
        setDeleteError(data.error || 'Failed to delete influencer');
        setDeleteTarget(null);
      }
    } catch {
      setDeleteError('Failed to delete influencer');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
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
            Party not assembled
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Add your first influencer persona with a reference photo.
          </p>
          <Link
            href="/influencers/new"
            className="mt-6 inline-flex items-center gap-2 overflow-hidden rounded border-2 border-electric bg-transparent px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric transition-all hover:bg-electric/10 hover:shadow-[0_0_24px_rgba(0,229,160,0.2)]"
          >
            <svg viewBox="0 0 8 10" fill="currentColor" className="h-2.5 w-2.5">
              <polygon points="0,0 8,5 0,10" />
            </svg>
            Recruit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Delete error banner */}
      {deleteError && (
        <div className="col-span-full rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-magenta">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="text-magenta/60 hover:text-magenta text-sm ml-4">Dismiss</button>
        </div>
      )}

      {influencers.map((influencer) => (
        <div
          key={influencer.id}
          onClick={() => router.push(`/influencers/${influencer.id}`)}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-300 hover:bg-surface-raised hover:shadow-lg hover:shadow-black/20 hover:border-magenta/40"
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
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                {influencer.status}
              </span>
              {/* Voice status indicator */}
              {influencer.voice_id ? (
                <button
                  type="button"
                  onClick={(e) => handleVoicePreview(e, influencer)}
                  className={`group/voice rounded-md p-1 transition-all ${
                    playingVoiceId === influencer.id
                      ? 'bg-lime/15 text-lime'
                      : 'text-lime/70 hover:bg-lime/10 hover:text-lime'
                  }`}
                  title={playingVoiceId === influencer.id ? 'Stop preview' : 'Play voice preview'}
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {playingVoiceId === influencer.id ? (
                      <>
                        <rect x="4" y="4" width="3" height="8" fill="currentColor" stroke="none" rx="0.5" />
                        <rect x="9" y="4" width="3" height="8" fill="currentColor" stroke="none" rx="0.5" />
                      </>
                    ) : (
                      <path d="M8 2v12M5 5l-2 3 2 3M11 5l2 3-2 3" />
                    )}
                  </svg>
                </button>
              ) : (
                <span className="rounded-md p-1 text-text-muted/40" title="No voice designed">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v12M5 5l-2 3 2 3M11 5l2 3-2 3" />
                    <line x1="2" y1="14" x2="14" y2="2" strokeWidth={1.5} />
                  </svg>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
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
        </div>
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
