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
  scene: { segment_index: number; section: string; visual_prompt: { start: string; end: string } | null } | null;
}

interface AssetReviewProps {
  projectId: string;
  onStatusChange?: () => void;
  confirmBeforeApprove?: { title: string; description: string; cost: string };
  onRegenerateAll?: () => Promise<void>;
  readOnly?: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  hook: 'Hook',
  problem: 'Problem',
  'solution+product': 'Solution + Product',
  cta: 'CTA',
};

export function AssetReview({ projectId, onStatusChange, confirmBeforeApprove, onRegenerateAll, readOnly }: AssetReviewProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [bySegment, setBySegment] = useState<Record<number, Asset[]>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keyframe editing state
  const [editTarget, setEditTarget] = useState<{ assetId: string; type: string; segmentIndex: number } | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [propagateTarget, setPropagateTarget] = useState<{ assetId: string; prompt: string; subsequentCount: number } | null>(null);
  const [propagateSubmitting, setPropagateSubmitting] = useState(false);
  const lastEditRef = useRef<{ assetId: string; prompt: string } | null>(null);

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

  // Auto-poll while any asset is generating or editing
  useEffect(() => {
    const hasPending = assets.some((a) => a.status === 'generating' || a.status === 'editing');
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(fetchAssets, 3000);
    } else if (!hasPending && pollRef.current) {
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

  // Detect edit completion and offer propagation
  useEffect(() => {
    if (!lastEditRef.current) return;
    const { assetId, prompt } = lastEditRef.current;
    const editedAsset = assets.find((a) => a.id === assetId);
    if (!editedAsset || editedAsset.status !== 'completed') return;

    // Edit completed — check for subsequent keyframes
    lastEditRef.current = null;
    const segIdx = editedAsset.scene?.segment_index ?? -1;
    const isStart = editedAsset.type === 'keyframe_start';

    const subsequentCount = assets.filter((a) => {
      if (!a.type.startsWith('keyframe') || a.status !== 'completed' || a.id === assetId) return false;
      const aSegIdx = a.scene?.segment_index ?? -1;
      if (aSegIdx > segIdx) return true;
      if (aSegIdx === segIdx && isStart && a.type === 'keyframe_end') return true;
      return false;
    }).length;

    if (subsequentCount > 0) {
      setPropagateTarget({ assetId, prompt, subsequentCount });
    }
  }, [assets]);

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

  function openEditModal(assetId: string) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setEditTarget({
      assetId,
      type: asset.type,
      segmentIndex: asset.scene?.segment_index ?? -1,
    });
    setEditPrompt('');
  }

  async function handleEditSubmit() {
    if (!editTarget || !editPrompt.trim()) return;
    setEditSubmitting(true);
    try {
      await fetch(`/api/projects/${projectId}/keyframes/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: editTarget.assetId, prompt: editPrompt.trim() }),
      });
      lastEditRef.current = { assetId: editTarget.assetId, prompt: editPrompt.trim() };
      setEditTarget(null);
      setEditPrompt('');
      fetchAssets();
    } catch (err) {
      console.error('Failed to submit keyframe edit:', err);
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handlePropagate() {
    if (!propagateTarget) return;
    setPropagateSubmitting(true);
    try {
      await fetch(`/api/projects/${projectId}/keyframes/propagate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: propagateTarget.assetId, prompt: propagateTarget.prompt }),
      });
      setPropagateTarget(null);
      fetchAssets();
    } catch (err) {
      console.error('Failed to propagate keyframe edit:', err);
    } finally {
      setPropagateSubmitting(false);
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
  const editingAssets = assets.filter((a) => a.status === 'editing').length;
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
          {editingAssets > 0 && (
            <span className="flex items-center gap-1.5 text-amber-hot">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-hot opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-hot" />
              </span>
              {editingAssets} editing
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
                        showGrade={!readOnly}
                        onGrade={readOnly ? undefined : handleGrade}
                        onReject={readOnly ? undefined : handleReject}
                        onRegenerate={readOnly ? undefined : handleRegenerate}
                        onEdit={!readOnly && confirmBeforeApprove ? openEditModal : undefined}
                      />
                    )}
                    {keyframeEnd && (
                      <AssetCard
                        asset={keyframeEnd}
                        showGrade={!readOnly}
                        onGrade={readOnly ? undefined : handleGrade}
                        onReject={readOnly ? undefined : handleReject}
                        onRegenerate={readOnly ? undefined : handleRegenerate}
                        onEdit={!readOnly && confirmBeforeApprove ? openEditModal : undefined}
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
                      showGrade={!readOnly}
                      onGrade={readOnly ? undefined : handleGrade}
                      onReject={readOnly ? undefined : handleReject}
                      onRegenerate={readOnly ? undefined : handleRegenerate}
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
                    showGrade={!readOnly}
                    onGrade={readOnly ? undefined : handleGrade}
                    onReject={readOnly ? undefined : handleReject}
                    onRegenerate={readOnly ? undefined : handleRegenerate}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-4">
          {hasIssues && (
            <p className="text-xs text-amber-hot">
              {failedAssets + rejectedAssets} asset{failedAssets + rejectedAssets > 1 ? 's' : ''} need attention. Regenerate or approve to continue.
            </p>
          )}
          <div className="ml-auto flex items-center gap-3">
            {onRegenerateAll && (
              <button
                type="button"
                onClick={() => setShowRegenConfirm(true)}
                disabled={regeneratingAll || generatingAssets > 0 || editingAssets > 0}
                className="inline-flex items-center gap-2 rounded-lg border border-phoenix/30 bg-phoenix/10 px-5 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-phoenix transition-all hover:bg-phoenix/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 8a6.5 6.5 0 0111.48-4.16" />
                  <path d="M14.5 8a6.5 6.5 0 01-11.48 4.16" />
                  <polyline points="13 1.5 13 4.5 10 4.5" />
                  <polyline points="3 14.5 3 11.5 6 11.5" />
                </svg>
                Regenerate All
              </button>
            )}
            <button
              type="button"
              onClick={() => confirmBeforeApprove ? setShowConfirm(true) : handleApprove()}
              disabled={approving || generatingAssets > 0 || editingAssets > 0}
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
      )}

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

      {/* Regenerate all confirmation dialog */}
      {showRegenConfirm && onRegenerateAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-fade-in-up rounded-xl border border-phoenix/30 bg-surface p-6">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
              Regenerate All Keyframes?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              This will delete all existing keyframes and restart generation from scratch using the same influencer and settings.
            </p>
            <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Estimated cost
              </span>
              <p className="font-[family-name:var(--font-mono)] text-lg font-bold text-amber-hot">
                ~$0.56
              </p>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowRegenConfirm(false)}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-text-secondary transition-all hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowRegenConfirm(false);
                  setRegeneratingAll(true);
                  try {
                    await onRegenerateAll();
                  } finally {
                    setRegeneratingAll(false);
                  }
                }}
                disabled={regeneratingAll}
                className="flex-1 rounded-lg bg-phoenix px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,107,61,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Regenerate All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-fade-in-up rounded-xl border border-amber-hot/30 bg-surface p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-hot/10">
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
                  Edit Keyframe
                </h3>
                <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${
                  editTarget.type === 'keyframe_start'
                    ? 'bg-electric/10 text-electric border-electric/30'
                    : 'bg-electric/10 text-electric border-electric/30'
                }`}>
                  {editTarget.type === 'keyframe_start' ? 'Start' : 'End'} — Segment {editTarget.segmentIndex + 1}
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Describe how you want this keyframe edited. The AI will apply your instructions while preserving the character and scene.
            </p>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="e.g. Make the lighting warmer, add a slight smile, change background to outdoor setting..."
              maxLength={2000}
              rows={4}
              autoFocus
              className="mt-3 block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-amber-hot focus:outline-none focus:ring-1 focus:ring-amber-hot"
            />
            <div className="mt-1 text-right">
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {editPrompt.length}/2000
              </span>
            </div>
            <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Cost
              </span>
              <p className="font-[family-name:var(--font-mono)] text-sm font-bold text-amber-hot">
                ~0.07 Gil
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { setEditTarget(null); setEditPrompt(''); }}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-text-secondary transition-all hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={editSubmitting || !editPrompt.trim()}
                className="flex-1 rounded-lg bg-amber-hot px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,171,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Edit Keyframe'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Propagation confirmation dialog */}
      {propagateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-fade-in-up rounded-xl border border-electric/30 bg-surface p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric/10">
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-electric" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v10M5 10l3 3 3-3" />
                </svg>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
                Propagate Edit?
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Apply this edit to <span className="font-[family-name:var(--font-mono)] font-bold text-electric">{propagateTarget.subsequentCount}</span> subsequent keyframe{propagateTarget.subsequentCount > 1 ? 's' : ''}? This ensures visual consistency across the remaining segments.
            </p>
            <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Estimated cost
              </span>
              <p className="font-[family-name:var(--font-mono)] text-sm font-bold text-amber-hot">
                ~{(propagateTarget.subsequentCount * 0.07).toFixed(2)} Gil
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setPropagateTarget(null)}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-text-secondary transition-all hover:bg-surface-raised"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handlePropagate}
                disabled={propagateSubmitting}
                className="flex-1 rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,229,160,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {propagateSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                    </svg>
                    Propagating...
                  </span>
                ) : (
                  `Propagate to ${propagateTarget.subsequentCount}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
