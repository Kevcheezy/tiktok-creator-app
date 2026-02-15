'use client';

import { useState, useEffect, useCallback } from 'react';
import { SegmentCard } from './segment-card';
import { ApproveControls } from './approve-controls';
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
  const [activeScript, setActiveScript] = useState(0);

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts`);
      if (res.ok) {
        const data = await res.json();
        setScripts(data);
      }
    } catch (err) {
      console.error('Failed to fetch scripts:', err);
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

  if (scripts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">No scripts generated yet.</p>
      </div>
    );
  }

  const script = scripts[activeScript];

  return (
    <div className="space-y-6">
      {/* Script version selector */}
      {scripts.length > 1 && (
        <div className="flex items-center gap-2">
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
        </div>
      )}

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
          <SegmentCard key={scene.id} scene={scene} />
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
    </div>
  );
}
