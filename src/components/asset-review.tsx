'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AssetCard } from './asset-card';

interface Asset {
  id: string;
  project_id: string;
  scene_id: string;
  type: string;
  url: string | null;
  status: string;
  provider: string | null;
  cost_usd: string | null;
  grade: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  scene: { segment_index: number; section: string } | null;
}

interface AssetReviewProps {
  projectId: string;
  onStatusChange?: () => void;
  confirmBeforeApprove?: { title: string; description: string; cost: string };
}

const SECTION_LABELS: Record<string, string> = {
  hook: 'Hook',
  problem: 'Problem',
  'solution+product': 'Solution + Product',
  cta: 'CTA',
};

export function AssetReview({ projectId, onStatusChange, confirmBeforeApprove }: AssetReviewProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [bySegment, setBySegment] = useState<Record<number, Asset[]>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
        setBySegment(data.bySegment);
        setFetchError(null);
      } else {
        setFetchError(`Failed to load assets (${res.status})`);
      }
    } catch {
      setFetchError('Network error — could not load assets');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Auto-poll while any asset is generating
  useEffect(() => {
    const hasGenerating = assets.some((a) => a.status === 'generating');
    if (hasGenerating && !pollRef.current) {
      pollRef.current = setInterval(fetchAssets, 3000);
    } else if (!hasGenerating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [assets, fetchAssets]);

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`/api/projects/${projectId}/approve`, { method: 'POST' });
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setApproving(false);
    }
  }

  async function handleGrade(assetId: string, grade: string) {
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, grade }),
      });
      fetchAssets();
    } catch (err) {
      console.error('Failed to grade asset:', err);
    }
  }

  async function handleReject(assetId: string) {
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, action: 'reject' }),
      });
      fetchAssets();
    } catch (err) {
      console.error('Failed to reject asset:', err);
    }
  }

  async function handleRegenerate(assetId: string) {
    try {
      await fetch(`/api/projects/${projectId}/assets/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      });
      fetchAssets();
    } catch (err) {
      console.error('Failed to regenerate asset:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-shimmer h-10 rounded-lg" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <div className="animate-shimmer h-6 w-24 rounded-md" />
              <div className="animate-shimmer h-64 rounded-xl" />
              <div className="animate-shimmer h-64 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-magenta/20 bg-magenta/5 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-raised">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-magenta" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v6" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
        </div>
        <p className="mt-4 font-[family-name:var(--font-display)] text-sm font-medium text-text-primary">
          {fetchError}
        </p>
        <button
          type="button"
          onClick={() => { setLoading(true); setFetchError(null); fetchAssets(); }}
          className="mt-4 rounded-lg border border-electric/30 bg-electric/10 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-medium text-electric transition-colors hover:bg-electric/20"
        >
          Retry
        </button>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No assets generated yet.</p>
      </div>
    );
  }

  const segmentIndices = Object.keys(bySegment)
    .map(Number)
    .filter((n) => n >= 0)
    .sort((a, b) => a - b);

  // Count stats
  const totalAssets = assets.length;
  const completedAssets = assets.filter((a) => a.status === 'completed').length;
  const failedAssets = assets.filter((a) => a.status === 'failed').length;
  const rejectedAssets = assets.filter((a) => a.status === 'rejected').length;
  const generatingAssets = assets.filter((a) => a.status === 'generating').length;
  const hasIssues = failedAssets > 0 || rejectedAssets > 0;

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
        <span className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          Assets
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-text-secondary">
            <span className="font-[family-name:var(--font-mono)] font-bold text-lime">{completedAssets}</span>/{totalAssets} completed
          </span>
          {generatingAssets > 0 && (
            <span className="flex items-center gap-1.5 text-electric">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-electric" />
              </span>
              {generatingAssets} generating
            </span>
          )}
          {failedAssets > 0 && (
            <span className="text-magenta">{failedAssets} failed</span>
          )}
          {rejectedAssets > 0 && (
            <span className="text-amber-hot">{rejectedAssets} rejected</span>
          )}
        </div>
      </div>

      {/* Segment cards */}
      <div className="stagger-children space-y-6">
        {segmentIndices.map((idx) => {
          const segmentAssets = bySegment[idx] || [];
          const section = segmentAssets[0]?.scene?.section || '';
          const sectionLabel = SECTION_LABELS[section] || `Segment ${idx}`;

          const keyframeStart = segmentAssets.find((a) => a.type === 'keyframe_start');
          const keyframeEnd = segmentAssets.find((a) => a.type === 'keyframe_end');
          const video = segmentAssets.find((a) => a.type === 'video');
          const audio = segmentAssets.find((a) => a.type === 'audio');

          return (
            <div key={idx} className="rounded-xl border border-border bg-surface p-5">
              {/* Segment header */}
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-overlay font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-muted">
                  {idx + 1}
                </span>
                <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-text-primary">
                  {sectionLabel}
                </h3>
              </div>

              {/* Keyframes side-by-side */}
              {(keyframeStart || keyframeEnd) && (
                <div className="mb-4">
                  <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Keyframes
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {keyframeStart && (
                      <AssetCard
                        asset={keyframeStart}
                        showGrade={true}
                        onGrade={handleGrade}
                        onReject={handleReject}
                        onRegenerate={handleRegenerate}
                      />
                    )}
                    {keyframeEnd && (
                      <AssetCard
                        asset={keyframeEnd}
                        showGrade={true}
                        onGrade={handleGrade}
                        onReject={handleReject}
                        onRegenerate={handleRegenerate}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Video */}
              {video && (
                <div className="mb-4">
                  <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Video
                  </h4>
                  <div className="max-w-sm">
                    <AssetCard
                      asset={video}
                      showGrade={true}
                      onGrade={handleGrade}
                      onReject={handleReject}
                      onRegenerate={handleRegenerate}
                    />
                  </div>
                </div>
              )}

              {/* Audio */}
              {audio && (
                <div>
                  <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Voiceover
                  </h4>
                  <AssetCard
                    asset={audio}
                    showGrade={true}
                    onGrade={handleGrade}
                    onReject={handleReject}
                    onRegenerate={handleRegenerate}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Approve button */}
      <div className="flex items-center justify-between gap-4">
        {hasIssues && (
          <p className="text-xs text-amber-hot">
            {failedAssets + rejectedAssets} asset{failedAssets + rejectedAssets > 1 ? 's' : ''} need attention. Regenerate or approve to continue.
          </p>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => confirmBeforeApprove ? setShowConfirm(true) : handleApprove()}
            disabled={approving || generatingAssets > 0}
            className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approving ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
                Approving...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3.5 8 6.5 11 12.5 5" />
                </svg>
                Approve &amp; Continue
              </>
            )}
          </button>
        </div>
      </div>

      {/* Cost confirmation dialog */}
      {showConfirm && confirmBeforeApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-fade-in-up rounded-xl border border-border bg-surface p-6">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
              {confirmBeforeApprove.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {confirmBeforeApprove.description}
            </p>
            <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Estimated cost
              </span>
              <p className="font-[family-name:var(--font-mono)] text-lg font-bold text-amber-hot">
                {confirmBeforeApprove.cost}
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-text-secondary transition-all hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowConfirm(false); handleApprove(); }}
                disabled={approving}
                className="flex-1 rounded-lg bg-lime px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm & Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
