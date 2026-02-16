'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================
// Types
// =============================================

interface BrollShot {
  id: string;
  project_id: string;
  segment_index: number;
  shot_index: number;
  category: string;
  prompt: string;
  narrative_role: string;
  timing_seconds: number;
  duration_seconds: number;
  source: 'ai_generated' | 'user_uploaded';
  image_url: string | null;
  status: 'planned' | 'generating' | 'completed' | 'replaced' | 'removed' | 'failed';
}

interface SegmentInfo {
  index: number;
  section: string;
  script_text: string;
  syllable_count: number;
  shot_scripts: { index: number; text: string }[];
}

interface StoryboardViewProps {
  projectId: string;
  onStatusChange?: () => void;
  readOnly?: boolean;
}

// =============================================
// Constants
// =============================================

const CATEGORY_COLORS: Record<string, string> = {
  transformation: 'magenta',
  research: 'electric',
  lifestyle: 'lime',
  social_proof: 'amber-hot',
  unboxing: 'electric',
  comparison: 'magenta',
  texture: 'lime',
  routine: 'electric',
  ingredients: 'amber-hot',
  action: 'magenta',
  setup: 'electric',
  results: 'lime',
  cooking: 'amber-hot',
  before_after: 'magenta',
  plating: 'lime',
  styling: 'magenta',
  detail: 'electric',
  space: 'lime',
  safety: 'amber-hot',
  usage: 'electric',
  reaction: 'magenta',
  data: 'electric',
};

const ALL_CATEGORIES = [
  'transformation', 'research', 'lifestyle', 'social_proof', 'unboxing',
  'comparison', 'texture', 'routine', 'ingredients', 'action', 'setup',
  'results', 'cooking', 'before_after', 'plating', 'styling', 'detail',
  'space', 'safety', 'usage', 'reaction', 'data',
];

const SEGMENT_TIME_RANGES = ['0:00 - 0:15', '0:15 - 0:30', '0:30 - 0:45', '0:45 - 1:00'];

const COST_PER_SHOT = 0.07;

// =============================================
// Helpers
// =============================================

function getCategoryColorClasses(category: string): { bg: string; text: string; border: string } {
  const color = CATEGORY_COLORS[category] || 'electric';
  return {
    bg: `bg-${color}/15`,
    text: `text-${color}`,
    border: `border-${color}/30`,
  };
}

// =============================================
// Main Component
// =============================================

export function StoryboardView({ projectId, onStatusChange, readOnly }: StoryboardViewProps) {
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [shots, setShots] = useState<BrollShot[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<BrollShot>>({});
  const [removedUndo, setRemovedUndo] = useState<{ id: string; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);

  // ---- Fetch data ----

  const fetchData = useCallback(async () => {
    try {
      const [scriptsRes, brollRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/scripts`),
        fetch(`/api/projects/${projectId}/broll`),
      ]);

      if (!scriptsRes.ok || !brollRes.ok) {
        throw new Error('Failed to load storyboard data');
      }

      const scriptsData = await scriptsRes.json();
      const brollData = await brollRes.json();

      // Get the latest script (first in array, sorted by version desc)
      const latestScript = scriptsData[0];
      if (latestScript?.scenes) {
        const segs: SegmentInfo[] = latestScript.scenes.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (scene: any) => ({
            index: scene.segment_index,
            section: scene.section || `Segment ${scene.segment_index}`,
            script_text: scene.script_text || '',
            syllable_count: scene.syllable_count || 0,
            shot_scripts: Array.isArray(scene.shot_scripts) ? scene.shot_scripts : [],
          })
        );
        segs.sort((a, b) => a.index - b.index);
        setSegments(segs);
      }

      setShots(brollData || []);
      setFetchError('');
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clean up undo timeout on unmount
  useEffect(() => {
    return () => {
      if (removedUndo) clearTimeout(removedUndo.timeout);
    };
  }, [removedUndo]);

  // ---- Computed values ----
  const activeShots = shots.filter((s) => s.status !== 'removed');
  const aiGeneratedCount = activeShots.filter((s) => s.source === 'ai_generated').length;
  const estimatedCost = aiGeneratedCount * COST_PER_SHOT;

  const categoryBreakdown = activeShots.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  // ---- Handlers ----

  const startEdit = useCallback((shot: BrollShot) => {
    setEditingId(shot.id);
    setEditDraft({
      prompt: shot.prompt,
      category: shot.category,
      timing_seconds: shot.timing_seconds,
      duration_seconds: shot.duration_seconds,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft({});
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;

    const updates: Record<string, unknown> = {};
    const shot = shots.find((s) => s.id === editingId);
    if (!shot) return;

    if (editDraft.prompt !== undefined && editDraft.prompt !== shot.prompt) updates.prompt = editDraft.prompt;
    if (editDraft.category !== undefined && editDraft.category !== shot.category) updates.category = editDraft.category;
    if (editDraft.timing_seconds !== undefined && editDraft.timing_seconds !== shot.timing_seconds) updates.timing_seconds = editDraft.timing_seconds;
    if (editDraft.duration_seconds !== undefined && editDraft.duration_seconds !== shot.duration_seconds) updates.duration_seconds = editDraft.duration_seconds;

    if (Object.keys(updates).length === 0) {
      setEditingId(null);
      setEditDraft({});
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/broll/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const updated = await res.json();
        setShots((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...updated } : s)));
      }
    } catch {
      // Optimistic update on failure — keep local changes
      setShots((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? {
                ...s,
                prompt: editDraft.prompt ?? s.prompt,
                category: editDraft.category ?? s.category,
                timing_seconds: editDraft.timing_seconds ?? s.timing_seconds,
                duration_seconds: editDraft.duration_seconds ?? s.duration_seconds,
              }
            : s
        )
      );
    }

    setEditingId(null);
    setEditDraft({});
  }, [editingId, editDraft, shots, projectId]);

  const removeShot = useCallback(async (shotId: string) => {
    // Optimistic update
    setShots((prev) => prev.map((s) => (s.id === shotId ? { ...s, status: 'removed' as const } : s)));

    // Clear previous undo if any
    if (removedUndo) clearTimeout(removedUndo.timeout);

    const timeout = setTimeout(() => {
      setRemovedUndo(null);
    }, 5000);

    setRemovedUndo({ id: shotId, timeout });

    // Fire API call
    try {
      await fetch(`/api/projects/${projectId}/broll/${shotId}`, { method: 'DELETE' });
    } catch {
      // If API fails, undo will still work from local state
    }
  }, [removedUndo, projectId]);

  const undoRemove = useCallback(() => {
    if (!removedUndo) return;
    clearTimeout(removedUndo.timeout);
    setShots((prev) => prev.map((s) => (s.id === removedUndo.id ? { ...s, status: 'planned' as const } : s)));
    setRemovedUndo(null);

    // TODO(backend): PATCH /broll/[shotId] doesn't allow `status` field.
    // Undo only works locally until page refresh. Backend needs to add
    // 'status' to allowedFields whitelist for undo to persist.
  }, [removedUndo]);

  const handleReplace = useCallback((shotId: string) => {
    replaceTargetRef.current = shotId;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetRef.current) return;

    const targetId = replaceTargetRef.current;
    replaceTargetRef.current = null;
    e.target.value = '';

    // Optimistic: show local preview
    const blobUrl = URL.createObjectURL(file);
    setShots((prev) =>
      prev.map((s) =>
        s.id === targetId
          ? { ...s, source: 'user_uploaded' as const, image_url: blobUrl, status: 'completed' as const }
          : s
      )
    );

    // Upload to server
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/projects/${projectId}/broll/${targetId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        // Replace blob URL with real URL
        URL.revokeObjectURL(blobUrl);
        setShots((prev) =>
          prev.map((s) =>
            s.id === targetId ? { ...s, image_url: data.imageUrl } : s
          )
        );
      }
    } catch {
      // Keep optimistic preview on failure
    }
  }, [projectId]);

  const addShot = useCallback(async (segmentIndex: number, shotScriptIndex: number) => {
    const segmentShots = shots.filter((s) => s.segment_index === segmentIndex && s.status !== 'removed');
    const lastTiming = segmentShots.length > 0
      ? Math.max(...segmentShots.map((s) => s.timing_seconds + s.duration_seconds))
      : segmentIndex * 15;

    try {
      const res = await fetch(`/api/projects/${projectId}/broll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment_index: segmentIndex,
          shot_index: shotScriptIndex,
          category: 'lifestyle',
          prompt: 'New B-roll shot',
          narrative_role: '',
          timing_seconds: lastTiming,
          duration_seconds: 2.5,
        }),
      });

      if (res.ok) {
        const newShot = await res.json();
        setShots((prev) => [...prev, newShot]);
        startEdit(newShot);
      }
    } catch {
      // Silently fail — user can try again
    }
  }, [shots, projectId, startEdit]);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    setApproveError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/broll/approve`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve B-roll plan');
      }

      onStatusChange?.();
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  }, [projectId, onStatusChange]);

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">Loading storyboard...</p>
        </div>
      </div>
    );
  }

  // ---- Error state ----

  if (fetchError) {
    return (
      <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-6">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 20 20" className="h-5 w-5 flex-shrink-0 text-magenta" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-medium text-magenta">{fetchError}</p>
            <button
              type="button"
              onClick={() => { setLoading(true); setFetchError(''); fetchData(); }}
              className="mt-2 text-xs text-text-muted transition-colors hover:text-electric"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Summary Bar (sticky) */}
      <div className="sticky top-0 z-20 rounded-xl border border-border bg-surface/95 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Total shots badge */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-electric" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-primary">
                {activeShots.length} shots
              </span>
            </span>

            {/* Estimated cost */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-raised px-3 py-1.5">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5v7M5.5 6.5h4a1 1 0 010 2h-3a1 1 0 000 2h4" />
              </svg>
              <span className="font-[family-name:var(--font-mono)] text-xs text-amber-hot">
                ${estimatedCost.toFixed(2)}
              </span>
            </span>

            {/* Category breakdown pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  const colors = getCategoryColorClasses(cat);
                  return (
                    <span
                      key={cat}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {cat.replace('_', ' ')}
                      <span className="font-[family-name:var(--font-mono)] text-[9px] opacity-70">{count}</span>
                    </span>
                  );
                })}
            </div>
          </div>

          {/* Approve button */}
          {!readOnly && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving || activeShots.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
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
          )}
        </div>

        {approveError && (
          <p className="mt-2 text-xs text-magenta">{approveError}</p>
        )}
      </div>

      {/* Undo toast */}
      {removedUndo && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up rounded-lg border border-border bg-surface-raised px-4 py-2.5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Shot removed.</span>
            <button
              type="button"
              onClick={undoRemove}
              className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric transition-colors hover:text-electric/80"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Segment Sections */}
      <div className="stagger-children space-y-8">
        {segments.map((segment) => {
          const segmentShots = shots.filter((s) => s.segment_index === segment.index);
          const segmentActiveShots = segmentShots.filter((s) => s.status !== 'removed');
          const segmentAiCount = segmentActiveShots.filter((s) => s.source === 'ai_generated').length;
          const segmentCost = segmentAiCount * COST_PER_SHOT;

          return (
            <div key={segment.index} className="rounded-xl border border-border bg-surface overflow-hidden">
              {/* Segment Header */}
              <div className="border-b border-border bg-surface-raised/50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-overlay font-[family-name:var(--font-mono)] text-xs font-bold text-text-muted">
                      {segment.index}
                    </span>
                    <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-text-primary">
                      {segment.section}
                    </h3>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                      {SEGMENT_TIME_RANGES[segment.index]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                      {segment.syllable_count} syl
                    </span>
                    <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
                      {segmentActiveShots.length} shots
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[11px] text-amber-hot">
                      ${segmentCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Segment Content with timeline border */}
              <div className="border-l-2 border-border ml-3 pl-5 py-4 pr-4 space-y-5">
                {segment.shot_scripts.map((shotScript) => {
                  const relatedShots = segmentShots.filter((s) => s.shot_index === shotScript.index);

                  return (
                    <div key={shotScript.index} className="space-y-3">
                      {/* Shot Script Card */}
                      <div className="rounded-lg border border-border/60 bg-surface-raised/30 px-4 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-surface-overlay font-[family-name:var(--font-mono)] text-[9px] font-bold text-text-muted">
                            {shotScript.index + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-text-secondary">
                            {shotScript.text}
                          </p>
                        </div>
                      </div>

                      {/* B-Roll Cards for this shot script */}
                      <div className="space-y-2 pl-2">
                        {relatedShots.map((shot) => (
                          <BrollCard
                            key={shot.id}
                            shot={shot}
                            isEditing={!readOnly && editingId === shot.id}
                            editDraft={!readOnly && editingId === shot.id ? editDraft : undefined}
                            onStartEdit={readOnly ? undefined : () => startEdit(shot)}
                            onCancelEdit={cancelEdit}
                            onSaveEdit={saveEdit}
                            onEditDraftChange={setEditDraft}
                            onRemove={readOnly ? undefined : () => removeShot(shot.id)}
                            onReplace={readOnly ? undefined : () => handleReplace(shot.id)}
                          />
                        ))}
                      </div>

                      {/* Add B-Roll button */}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => addShot(segment.index, shotScript.index)}
                          className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-text-muted transition-all hover:border-electric/40 hover:text-electric"
                        >
                          <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <line x1="8" y1="3" x2="8" y2="13" />
                            <line x1="3" y1="8" x2="13" y2="8" />
                          </svg>
                          Add B-roll
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// B-Roll Card Sub-component
// =============================================

interface BrollCardProps {
  shot: BrollShot;
  isEditing: boolean;
  editDraft?: Partial<BrollShot>;
  onStartEdit?: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditDraftChange: (draft: Partial<BrollShot>) => void;
  onRemove?: () => void;
  onReplace?: () => void;
}

function BrollCard({
  shot,
  isEditing,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditDraftChange,
  onRemove,
  onReplace,
}: BrollCardProps) {
  const isRemoved = shot.status === 'removed';
  const colors = getCategoryColorClasses(isEditing && editDraft?.category ? editDraft.category : shot.category);

  return (
    <div
      className={`group rounded-lg border bg-surface p-4 transition-all ${
        isRemoved
          ? 'border-border/50 opacity-60'
          : 'border-border hover:border-border-bright'
      }`}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {shot.image_url ? (
            <div className="h-[72px] w-[72px] overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.image_url}
                alt={`B-roll: ${shot.category}`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-raised">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Category badge + timing */}
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <select
                value={editDraft?.category || shot.category}
                onChange={(e) => onEditDraftChange({ ...editDraft, category: e.target.value })}
                className={`appearance-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all focus:outline-none focus:ring-1 focus:ring-electric ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-surface text-text-primary">
                    {cat.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {shot.category.replace('_', ' ')}
              </span>
            )}

            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              @{shot.timing_seconds}s
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
              {shot.duration_seconds}s
            </span>

            {shot.source === 'user_uploaded' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-lime/10 border border-lime/20 px-2 py-0.5 text-[10px] font-medium text-lime">
                <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M6 8V3M4 5l2-2 2 2" />
                </svg>
                uploaded
              </span>
            )}
          </div>

          {/* Prompt text */}
          {isEditing ? (
            <textarea
              value={editDraft?.prompt ?? shot.prompt}
              onChange={(e) => onEditDraftChange({ ...editDraft, prompt: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              placeholder="Describe the B-roll shot..."
            />
          ) : (
            <p className={`text-sm leading-relaxed text-text-secondary ${isRemoved ? 'line-through opacity-40' : ''}`}>
              {shot.prompt || <span className="italic text-text-muted">No prompt set</span>}
            </p>
          )}

          {/* Narrative role */}
          {!isEditing && shot.narrative_role && (
            <p className="text-xs italic text-text-muted">
              {shot.narrative_role}
            </p>
          )}

          {/* Timing inputs in edit mode */}
          {isEditing && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">Timing</span>
                <input
                  type="number"
                  step={0.5}
                  min={0}
                  value={editDraft?.timing_seconds ?? shot.timing_seconds}
                  onChange={(e) => onEditDraftChange({ ...editDraft, timing_seconds: parseFloat(e.target.value) || 0 })}
                  className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">s</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">Duration</span>
                <input
                  type="number"
                  step={0.5}
                  min={1}
                  max={4}
                  value={editDraft?.duration_seconds ?? shot.duration_seconds}
                  onChange={(e) => onEditDraftChange({ ...editDraft, duration_seconds: parseFloat(e.target.value) || 1 })}
                  className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">s</span>
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="inline-flex items-center gap-1.5 rounded-md bg-electric px-3 py-1 font-[family-name:var(--font-display)] text-xs font-semibold text-void transition-all hover:shadow-[0_0_16px_rgba(0,240,255,0.3)]"
                >
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6 5 8.5 9.5 3.5" />
                  </svg>
                  Save
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:border-border-bright hover:text-text-secondary"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className={`flex items-center gap-2 ${isRemoved ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                {!isRemoved && (onStartEdit || onReplace || onRemove) && (
                  <>
                    {onStartEdit && (
                      <button
                        type="button"
                        onClick={onStartEdit}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-electric/30 hover:text-electric"
                      >
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 2l3 3L4 11H1V8L7 2z" />
                        </svg>
                        Edit
                      </button>
                    )}
                    {onReplace && (
                      <button
                        type="button"
                        onClick={onReplace}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-electric/30 hover:text-electric"
                      >
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                          <path d="M6 8V3M4 5l2-2 2 2M2 10h8" />
                        </svg>
                        Replace
                      </button>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-text-muted transition-all hover:border-magenta/30 hover:text-magenta"
                      >
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                          <line x1="3" y1="3" x2="9" y2="9" />
                          <line x1="9" y1="3" x2="3" y2="9" />
                        </svg>
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
