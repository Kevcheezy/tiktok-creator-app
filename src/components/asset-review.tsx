'use client';

import { useState, useEffect, useCallback } from 'react';
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

const ASSET_TYPE_ORDER = ['keyframe_start', 'keyframe_end', 'video', 'audio'];

export function AssetReview({ projectId, onStatusChange, confirmBeforeApprove }: AssetReviewProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [bySegment, setBySegment] = useState<Record<number, Asset[]>>({});
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
        setBySegment(data.bySegment);
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

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

  return (
    <div className="space-y-6">
      <div className="stagger-children grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {segmentIndices.map((idx) => {
          const segmentAssets = bySegment[idx] || [];
          const section = segmentAssets[0]?.scene?.section || '';
          const sectionLabel = SECTION_LABELS[section] || `Segment ${idx}`;

          const sorted = [...segmentAssets].sort(
            (a, b) => ASSET_TYPE_ORDER.indexOf(a.type) - ASSET_TYPE_ORDER.indexOf(b.type)
          );

          return (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-muted">
                  {idx}
                </span>
                <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {sectionLabel}
                </h3>
              </div>
              {sorted.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  showGrade={true}
                  onGrade={handleGrade}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => confirmBeforeApprove ? setShowConfirm(true) : handleApprove()}
          disabled={approving}
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
