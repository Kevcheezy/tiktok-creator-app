'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  updated_at: string | null;
}

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InfluencerDetail({ influencerId }: { influencerId: string }) {
  const router = useRouter();
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/influencers/${influencerId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/influencers');
      }
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [influencerId, router]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleImageUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/influencers/${influencerId}`, {
        method: 'PATCH',
        body: formData,
      });
      if (res.ok) {
        const updated = await res.json();
        setInfluencer(updated);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  }, [influencerId]);

  const handleCancelPreview = useCallback(() => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    fetch(`/api/influencers/${influencerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setInfluencer(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [influencerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div
              className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">
            Loading influencer...
          </p>
        </div>
      </div>
    );
  }

  if (error || !influencer) {
    return (
      <div className="animate-fade-in-up">
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-8 w-8 text-text-muted"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="mt-4 text-text-secondary">Influencer not found.</p>
          <Link
            href="/influencers"
            className="mt-4 inline-flex text-sm text-electric hover:underline"
          >
            Back to Influencers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Back link */}
      <Link
        href="/influencers"
        className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-sm text-text-secondary transition-colors hover:text-electric"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-4 w-4"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="8" x2="4" y2="8" />
          <polyline points="8 4 4 8 8 12" />
        </svg>
        Influencers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
            {influencer.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-md bg-surface-overlay px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
              {influencer.status}
            </span>
            {influencer.created_at && (
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                Created {formatDate(influencer.created_at)}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex-shrink-0 rounded-lg border border-border p-2.5 text-text-muted transition-all hover:border-magenta/40 hover:bg-magenta/5 hover:text-magenta"
          title="Delete influencer"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4h12" />
            <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
            <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
            <line x1="6.5" y1="7" x2="6.5" y2="11" />
            <line x1="9.5" y1="7" x2="9.5" y2="11" />
          </svg>
        </button>
      </div>

      {/* Base Image */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Reference Image
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {previewUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  disabled={uploading}
                  className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={uploading}
                  className="rounded-lg border border-electric/30 bg-electric/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-electric transition-colors hover:bg-electric/20 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-electric/40 hover:bg-electric/5 hover:text-electric"
              >
                {influencer.image_url ? 'Replace Image' : 'Upload Image'}
              </button>
            )}
          </div>
        </div>

        {/* Preview of new image (before confirming) */}
        {previewUrl && (
          <div className="mb-4 rounded-lg border-2 border-dashed border-electric/40 bg-electric/5 p-3">
            <p className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-electric">
              New Image Preview
            </p>
            <img
              src={previewUrl}
              alt="New reference preview"
              className="max-h-64 rounded-lg object-contain"
            />
          </div>
        )}

        {/* Current image */}
        {influencer.image_url ? (
          <div className="relative overflow-hidden rounded-lg border border-border-bright bg-surface-raised">
            <img
              src={influencer.image_url}
              alt={`${influencer.name} reference`}
              className="w-full max-w-lg object-contain"
            />
            <div className="absolute right-0 top-0 h-16 w-16">
              <div className="absolute right-0 top-0 h-px w-8 bg-gradient-to-l from-magenta/50 to-transparent" />
              <div className="absolute right-0 top-0 h-8 w-px bg-gradient-to-b from-magenta/50 to-transparent" />
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-bright bg-surface-raised">
            <div className="text-center">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                className="mx-auto h-10 w-10 text-text-muted"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="24" height="24" rx="3" />
                <circle cx="11" cy="13" r="3" />
                <path d="M28 22l-6-6-14 14" />
              </svg>
              <p className="mt-3 text-sm text-text-muted">No reference image uploaded</p>
            </div>
          </div>
        )}
      </div>

      {/* Persona */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Persona
        </h2>
        {influencer.persona ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            {influencer.persona}
          </p>
        ) : (
          <p className="text-sm italic text-text-muted">No persona description provided</p>
        )}
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Details
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              ID
            </dt>
            <dd className="mt-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
              {influencer.id}
            </dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Status
            </dt>
            <dd className="mt-1 text-sm text-text-primary">{influencer.status}</dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Has Image
            </dt>
            <dd className="mt-1 text-sm text-text-primary">
              {influencer.image_url ? (
                <span className="text-lime">Yes</span>
              ) : (
                <span className="text-text-muted">No</span>
              )}
            </dd>
          </div>
          {influencer.created_at && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Created
              </dt>
              <dd className="mt-1 text-sm text-text-secondary">
                {formatDate(influencer.created_at)}
              </dd>
            </div>
          )}
          {influencer.updated_at && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Updated
              </dt>
              <dd className="mt-1 text-sm text-text-secondary">
                {formatDate(influencer.updated_at)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Influencer"
        description={`Are you sure you want to delete "${influencer.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
    </div>
  );
}
