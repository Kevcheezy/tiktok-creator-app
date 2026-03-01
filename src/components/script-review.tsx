'use client';

import { useState, useEffect, useCallback } from 'react';
import { SegmentCard } from './segment-card';
import { ScriptBreakdown } from './script-breakdown';
import { HighlightedText } from './highlighted-text';
import { ApproveControls } from './approve-controls';
import { ScriptUpload } from './script-upload';
import { EnergyArcGraph } from './energy-arc-graph';
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
  broll_cues: { shot_script_index: number; offset_seconds: number; duration_seconds: number; intent: string; spoken_text_during: string }[] | null;
  tone: string | null;
  segment_score: { total: number; [criterion: string]: number } | null;
  version: number;
  created_at: string;
}

interface StylePreset {
  id: string;
  name: string;
  status: 'analyzing' | 'ready' | 'failed';
  total_score: number | null;
  patterns: {
    hook_technique: string;
    energy_arc: Record<string, unknown>;
    product_integration_style: string;
    cta_formula: string;
    pacing: string;
  } | null;
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
  readOnly,
  productTerms,
}: {
  projectId: string;
  onStatusChange?: () => void;
  readOnly?: boolean;
  productTerms?: string[];
}) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [breakdownView, setBreakdownView] = useState<'cards' | 'timeline' | 'beats'>('beats');
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const DEFAULT_SYLLABLE_TARGETS = {
    hook: { min: 70, max: 70 },
    problem: { min: 70, max: 70 },
    solution_product: { min: 70, max: 70 },
    cta: { min: 70, max: 70 },
  };

  const [syllableTargets, setSyllableTargets] = useState(DEFAULT_SYLLABLE_TARGETS);
  const [targetsModified, setTargetsModified] = useState(false);
  const [showPacingControls, setShowPacingControls] = useState(false);
  const [pacingSaving, setPacingSaving] = useState(false);

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

  // Fetch available style presets
  useEffect(() => {
    fetch('/api/style-presets')
      .then((res) => (res.ok ? res.json() : { presets: [] }))
      .then((data) => {
        setPresets((data.presets || []).filter((p: StylePreset) => p.status === 'ready'));
      })
      .catch(() => setPresets([]));
  }, []);

  // Fetch the project's current style_preset_id and syllable_targets
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.style_preset_id) {
          setSelectedPresetId(data.style_preset_id);
        }
        if (data?.syllable_targets) {
          setSyllableTargets(data.syllable_targets);
        }
      })
      .catch(() => {});
  }, [projectId]);

  const activePreset = presets.find((p) => p.id === selectedPresetId) || null;

  const handlePresetChange = useCallback(async (presetId: string | null) => {
    setSelectedPresetId(presetId);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_preset_id: presetId }),
      });
    } catch (err) {
      console.error('Failed to update style preset:', err);
    }
  }, [projectId]);

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
            {(() => {
              const totalGeneratedScore = script.scenes.reduce(
                (sum, s) => sum + (s.segment_score?.total || 0),
                0
              );
              return activePreset && activePreset.total_score && totalGeneratedScore > 0 ? (
                <span className="rounded-md bg-summon/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-summon">
                  Match: {Math.round((totalGeneratedScore / activePreset.total_score) * 100)}%
                </span>
              ) : null;
            })()}
            {script.tone && (
              <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-display)] text-xs text-text-secondary">
                {SCRIPT_TONES[script.tone as keyof typeof SCRIPT_TONES]?.label || script.tone}
              </span>
            )}
          </>
        )}
        {!readOnly && (
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
        )}
      </div>

      {/* Style Preset Selector */}
      {presets.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Style Preset
              </span>
              {activePreset && activePreset.total_score !== null && (
                <span className="rounded-md bg-summon/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-summon">
                  {activePreset.total_score}/44
                </span>
              )}
            </div>
            <select
              value={selectedPresetId || ''}
              onChange={(e) => handlePresetChange(e.target.value || null)}
              className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs text-text-primary focus:border-electric focus:outline-none"
            >
              <option value="">No preset</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.total_score}/44)</option>
              ))}
            </select>
          </div>
          {activePreset && activePreset.patterns && (
            <div className="mt-2 flex flex-wrap gap-2">
              {activePreset.patterns.hook_technique && (
                <span className="rounded-full bg-electric/10 px-2 py-0.5 text-[10px] text-electric">
                  {activePreset.patterns.hook_technique}
                </span>
              )}
              {activePreset.patterns.pacing && (
                <span className="rounded-full bg-phoenix/10 px-2 py-0.5 text-[10px] text-phoenix">
                  {activePreset.patterns.pacing}
                </span>
              )}
              {activePreset.patterns.cta_formula && (
                <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] text-lime">
                  {activePreset.patterns.cta_formula}
                </span>
              )}
            </div>
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
            <HighlightedText text={script.full_text} terms={productTerms} />
          </p>
        </div>
      )}

      {/* Energy arc sparkline */}
      {script.scenes.some((s) => s.energy_arc) && (
        <EnergyArcGraph
          arcs={script.scenes.map((s) => s.energy_arc)}
          sectionLabels={script.scenes.map((s) => s.section.replace('solution+product', 'Sol+Prod').replace(/^\w/, (c) => c.toUpperCase()))}
        />
      )}

      {/* View toggle */}
      <div className="flex items-center gap-3">
        <span className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          View
        </span>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5">
          {(['cards', 'timeline', 'beats'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setBreakdownView(mode)}
              className={`rounded-md px-3 py-1 font-[family-name:var(--font-display)] text-xs font-semibold transition-all ${
                breakdownView === mode
                  ? 'bg-electric/10 text-electric border border-electric/30'
                  : 'border border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {mode === 'cards' ? 'Cards' : mode === 'timeline' ? 'Timeline' : 'Beats'}
            </button>
          ))}
        </div>
      </div>

      {/* Pacing Controls (beats view only) */}
      {breakdownView === 'beats' && (
        <div className="rounded-xl border border-border bg-surface">
          <button
            type="button"
            onClick={() => setShowPacingControls(!showPacingControls)}
            className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-surface-raised/50"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Pacing Controls
            </span>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className={`h-3.5 w-3.5 text-text-muted transition-transform ${showPacingControls ? 'rotate-180' : ''}`}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {showPacingControls && (
            <div className="border-t border-border px-4 pb-4 pt-3">
              <div className="space-y-2.5">
                {([
                  { key: 'hook' as const, label: 'Hook', dotColor: 'bg-magenta' },
                  { key: 'problem' as const, label: 'Problem', dotColor: 'bg-amber-hot' },
                  { key: 'solution_product' as const, label: 'Solution + Product', dotColor: 'bg-electric' },
                  { key: 'cta' as const, label: 'CTA', dotColor: 'bg-lime' },
                ]).map(({ key, label, dotColor }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor}`} />
                    <span className="w-32 flex-shrink-0 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
                      {label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={syllableTargets[key].min}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSyllableTargets((prev) => ({ ...prev, [key]: { ...prev[key], min: val } }));
                          setTargetsModified(true);
                        }}
                        className="w-16 rounded bg-surface-overlay border border-border px-2 py-1 text-xs font-mono text-text-primary"
                      />
                      <span className="text-[10px] text-text-muted">&ndash;</span>
                      <input
                        type="number"
                        value={syllableTargets[key].max}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSyllableTargets((prev) => ({ ...prev, [key]: { ...prev[key], max: val } }));
                          setTargetsModified(true);
                        }}
                        className="w-16 rounded bg-surface-overlay border border-border px-2 py-1 text-xs font-mono text-text-primary"
                      />
                      <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">syl</span>
                    </div>
                  </div>
                ))}
              </div>
              {targetsModified && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={pacingSaving}
                    onClick={async () => {
                      setPacingSaving(true);
                      try {
                        await fetch(`/api/projects/${projectId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ syllable_targets: syllableTargets }),
                        });
                        const currentTone = script.tone || 'reluctant-insider';
                        await fetch(`/api/projects/${projectId}/scripts/${script.id}/regenerate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ tone: currentTone }),
                        });
                        setTargetsModified(false);
                        onStatusChange?.();
                      } catch (err) {
                        console.error('Failed to apply pacing targets:', err);
                      } finally {
                        setPacingSaving(false);
                      }
                    }}
                    className="inline-flex items-center rounded-lg border border-electric/30 bg-electric/10 px-4 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold text-electric transition-colors hover:bg-electric/20 disabled:opacity-50"
                  >
                    {pacingSaving ? 'Applying...' : 'Apply & Regenerate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSyllableTargets(DEFAULT_SYLLABLE_TARGETS);
                      setTargetsModified(false);
                    }}
                    className="font-[family-name:var(--font-display)] text-xs font-medium text-text-muted underline underline-offset-2 transition-colors hover:text-text-secondary"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Segment views */}
      {breakdownView === 'cards' && (
        <div className="stagger-children grid grid-cols-1 gap-4 lg:grid-cols-2">
          {script.scenes.map((scene) => (
            <SegmentCard
              key={scene.id}
              scene={scene}
              editable={!readOnly}
              projectId={projectId}
              scriptId={script.id}
              onSegmentUpdate={() => fetchScripts()}
              productTerms={productTerms}
            />
          ))}
        </div>
      )}
      {breakdownView === 'timeline' && <ScriptBreakdown scenes={script.scenes} view="timeline" productTerms={productTerms} />}
      {breakdownView === 'beats' && <ScriptBreakdown scenes={script.scenes} view="beats" productTerms={productTerms} syllableTargets={syllableTargets} />}

      {/* Approve / Regenerate controls */}
      {!readOnly && (
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
      )}

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
