'use client';

import { useState, useEffect, useCallback } from 'react';
import { SegmentCard } from './segment-card';
import { ApproveControls } from './approve-controls';
import { ScriptUpload } from './script-upload';
import { SCRIPT_TONES } from '@/lib/constants';

interface Scene {
  id: string;
  script_id: string;
  segment_index: number;
  section: string;
  script_text: string | null;
  syllable_count: number | null;
  energy_arc: { start: string; middle: string; end: string } | null;
  shot_scripts: { index: number; text: string; energy: string }[] | null;
  audio_sync: Record<string, { word: string; time: string; action: string }> | null;
  text_overlay: string | null;
  product_visibility: string | null;
  tone: string | null;
  version: number;
  created_at: string;
}

interface Script {
  id: string;
  project_id: string;
  version: number;
  hook_score: number | null;
  grade: string | null;
  tone: string | null;
  is_favorite: boolean;
  feedback: string | null;
  full_text: string | null;
  created_at: string;
  scenes: Scene[];
}

export function ScriptReview({
  projectId,
  onStatusChange,
}: {
  projectId: string;
  onStatusChange?: () => void;
}) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts`);
      if (res.ok) {
        const data = await res.json();
        setScripts(data);
        setFetchError(null);
      } else {
        setFetchError(`Failed to load scripts (${res.status})`);
      }
    } catch {
      setFetchError('Network error — could not load scripts');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-shimmer h-10 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-shimmer h-64 rounded-xl" />
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
          onClick={() => { setLoading(true); setFetchError(null); fetchScripts(); }}
          className="mt-4 rounded-lg border border-electric/30 bg-electric/10 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-medium text-electric transition-colors hover:bg-electric/20"
        >
          Retry
        </button>
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <p className="mb-4 text-sm text-text-secondary">No scripts generated yet.</p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center rounded-lg border border-electric/30 bg-electric/10 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-electric transition-all hover:bg-electric/20"
          >
            <svg viewBox="0 0 16 16" className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 11V3M4.5 5.5L8 2l3.5 3.5M2 14h12" />
            </svg>
            Upload Script
          </button>
        </div>
        {showUpload && (
          <ScriptUpload
            projectId={projectId}
            onSuccess={() => fetchScripts()}
            onClose={() => setShowUpload(false)}
          />
        )}
      </>
    );
  }

  const script = scripts[activeScript];

  return (
    <div className="space-y-6">
      {/* Script version selector */}
      <div className="flex items-center gap-2">
        {scripts.length > 1 && (
          <>
            <span className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Version
            </span>
            <div className="flex gap-1">
              {scripts.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveScript(i)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg font-[family-name:var(--font-mono)] text-xs font-bold transition-all ${
                    activeScript === i
                      ? 'bg-electric/10 text-electric border border-electric/30'
                      : 'bg-surface border border-border text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {s.version}
                </button>
              ))}
            </div>
            {script.grade && (
              <span className="ml-2 rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-display)] text-xs font-bold text-text-secondary">
                Grade: {script.grade}
              </span>
            )}
            {script.hook_score !== null && (
              <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-text-muted">
                Hook: {script.hook_score}
              </span>
            )}
            {script.tone && (
              <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-display)] text-xs text-text-secondary">
                {SCRIPT_TONES[script.tone as keyof typeof SCRIPT_TONES]?.label || script.tone}
              </span>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="ml-auto inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition-all hover:border-electric/30 hover:text-electric"
        >
          <svg viewBox="0 0 16 16" className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 11V3M4.5 5.5L8 2l3.5 3.5M2 14h12" />
          </svg>
          Upload Script
        </button>
      </div>

      {/* Full script text */}
      {script.full_text && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
            Full Script
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            {script.full_text}
          </p>
        </div>
      )}

      {/* Segment cards grid */}
      <div className="stagger-children grid grid-cols-1 gap-4 lg:grid-cols-2">
        {script.scenes.map((scene) => (
          <SegmentCard
            key={scene.id}
            scene={scene}
            editable={true}
            projectId={projectId}
            scriptId={script.id}
            onSegmentUpdate={() => fetchScripts()}
          />
        ))}
      </div>

      {/* Approve / Regenerate controls */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <ApproveControls
          projectId={projectId}
          scriptId={script.id}
          currentGrade={script.grade}
          currentFeedback={script.feedback}
          currentTone={script.tone || 'reluctant-insider'}
          onGradeChange={() => fetchScripts()}
          onApprove={() => onStatusChange?.()}
          onRegenerate={() => onStatusChange?.()}
        />
      </div>

      {/* Upload Script Modal */}
      {showUpload && (
        <ScriptUpload
          projectId={projectId}
          onSuccess={() => fetchScripts()}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
