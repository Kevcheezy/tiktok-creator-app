'use client';

import { useState, useCallback, useRef } from 'react';

interface Concept {
  persona: {
    demographics: string;
    psychographics: string;
    current_situation: string;
    desired_outcomes: string;
  };
  pain_points: {
    functional: string[];
    emotional: string[];
  };
  unique_mechanism: string;
  transformation: {
    before: string;
    after: string;
  };
  hook_angle: string;
}

interface ConceptReviewProps {
  projectId: string;
  concept: Concept | null;
  productData: {
    product_name?: string;
    category?: string;
    selling_points?: string[];
    hook_angle?: string;
  } | null;
  onStatusChange?: () => void;
  readOnly?: boolean;
}

const DEFAULT_CONCEPT: Concept = {
  persona: {
    demographics: '',
    psychographics: '',
    current_situation: '',
    desired_outcomes: '',
  },
  pain_points: {
    functional: [],
    emotional: [],
  },
  unique_mechanism: '',
  transformation: {
    before: '',
    after: '',
  },
  hook_angle: '',
};

export function ConceptReview({
  projectId,
  concept,
  productData,
  onStatusChange,
  readOnly = false,
}: ConceptReviewProps) {
  const [localConcept, setLocalConcept] = useState<Concept>(() => {
    const base = concept ?? DEFAULT_CONCEPT;
    // Pre-fill hook_angle from productData if concept doesn't have one
    if (!base.hook_angle && productData?.hook_angle) {
      return { ...base, hook_angle: productData.hook_angle };
    }
    return base;
  });
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New pain point input state
  const [newFunctional, setNewFunctional] = useState('');
  const [newEmotional, setNewEmotional] = useState('');

  // Auto-save on blur
  const autoSave = useCallback(
    async (updated: Concept) => {
      setSaving(true);
      setSaveStatus('idle');
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ concept: updated }),
        });
        if (res.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        setSaving(false);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      }
    },
    [projectId],
  );

  function updatePersona(field: keyof Concept['persona'], value: string) {
    setLocalConcept((prev) => {
      const updated = { ...prev, persona: { ...prev.persona, [field]: value } };
      return updated;
    });
  }

  function handlePersonaBlur() {
    autoSave(localConcept);
  }

  function updateUniqueM(value: string) {
    setLocalConcept((prev) => ({ ...prev, unique_mechanism: value }));
  }

  function updateTransformation(field: 'before' | 'after', value: string) {
    setLocalConcept((prev) => ({
      ...prev,
      transformation: { ...prev.transformation, [field]: value },
    }));
  }

  function updateHookAngle(value: string) {
    setLocalConcept((prev) => ({ ...prev, hook_angle: value }));
  }

  // Pain point management
  function addPainPoint(type: 'functional' | 'emotional', value: string) {
    if (!value.trim()) return;
    setLocalConcept((prev) => {
      const updated = {
        ...prev,
        pain_points: {
          ...prev.pain_points,
          [type]: [...prev.pain_points[type], value.trim()],
        },
      };
      autoSave(updated);
      return updated;
    });
    if (type === 'functional') setNewFunctional('');
    else setNewEmotional('');
  }

  function removePainPoint(type: 'functional' | 'emotional', index: number) {
    setLocalConcept((prev) => {
      const updated = {
        ...prev,
        pain_points: {
          ...prev.pain_points,
          [type]: prev.pain_points[type].filter((_, i) => i !== index),
        },
      };
      autoSave(updated);
      return updated;
    });
  }

  function updatePainPoint(type: 'functional' | 'emotional', index: number, value: string) {
    setLocalConcept((prev) => {
      const items = [...prev.pain_points[type]];
      items[index] = value;
      return {
        ...prev,
        pain_points: { ...prev.pain_points, [type]: items },
      };
    });
  }

  function handlePainPointBlur(type: 'functional' | 'emotional') {
    autoSave(localConcept);
    void type; // used to trigger save on blur for inline edits
  }

  async function handleApprove() {
    setApproving(true);
    try {
      // Save latest concept first
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: localConcept }),
      });
      // Approve to advance pipeline
      await fetch(`/api/projects/${projectId}/approve`, { method: 'POST' });
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to approve concept:', err);
    } finally {
      setApproving(false);
    }
  }

  // Loading skeleton when concept is null and not read-only
  if (!concept && !readOnly) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8">
        <div className="flex items-center gap-4">
          <div className="relative h-8 w-8 flex-shrink-0">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div
              className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric-dim"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
          </div>
          <div className="flex-1">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">
              Generating concept...
            </h3>
            <p className="mt-0.5 text-sm text-text-secondary">
              Building strategic concept from product analysis. This typically takes 15-30 seconds.
            </p>
          </div>
        </div>
        {/* Skeleton blocks */}
        <div className="mt-6 space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="animate-pulse">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-surface-overlay" />
                <div className="h-3 w-24 rounded bg-surface-overlay" />
              </div>
              <div className="h-16 rounded-lg bg-surface-overlay" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Save status indicator */}
      {saveStatus !== 'idle' && (
        <div className="flex justify-end">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-wider ${
              saveStatus === 'saved'
                ? 'bg-lime/10 text-lime border border-lime/20'
                : 'bg-magenta/10 text-magenta border border-magenta/20'
            }`}
          >
            {saving ? (
              <>
                <span className="h-1.5 w-1.5 animate-materia-pulse rounded-full bg-current" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5" />
                </svg>
                Saved
              </>
            ) : (
              <>
                <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3v4M6 9h.01" />
                </svg>
                Save failed
              </>
            )}
          </span>
        </div>
      )}

      {/* Section 1: Target Persona */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
            1
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Target Persona
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Demographics
            </label>
            <textarea
              value={localConcept.persona.demographics}
              onChange={(e) => updatePersona('demographics', e.target.value)}
              onBlur={handlePersonaBlur}
              disabled={readOnly}
              placeholder="Women 25-40, post-partum, household income $60K-120K"
              rows={3}
              className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Psychographics
            </label>
            <textarea
              value={localConcept.persona.psychographics}
              onChange={(e) => updatePersona('psychographics', e.target.value)}
              onBlur={handlePersonaBlur}
              disabled={readOnly}
              placeholder="Health-conscious, follows wellness influencers, values natural ingredients"
              rows={3}
              className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Current Situation
            </label>
            <textarea
              value={localConcept.persona.current_situation}
              onChange={(e) => updatePersona('current_situation', e.target.value)}
              onBlur={handlePersonaBlur}
              disabled={readOnly}
              placeholder="Struggling with post-pregnancy body changes, low energy, tried multiple products"
              rows={3}
              className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Desired Outcomes
            </label>
            <textarea
              value={localConcept.persona.desired_outcomes}
              onChange={(e) => updatePersona('desired_outcomes', e.target.value)}
              onBlur={handlePersonaBlur}
              disabled={readOnly}
              placeholder="Feel confident again, fit into pre-pregnancy clothes, have energy for kids"
              rows={3}
              className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Pain Points */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
            2
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Pain Points
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Functional */}
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Functional
            </label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {localConcept.pain_points.functional.map((item, i) => (
                  <PainPointPill
                    key={`f-${i}`}
                    value={item}
                    onChange={(val) => updatePainPoint('functional', i, val)}
                    onBlur={() => handlePainPointBlur('functional')}
                    onRemove={() => removePainPoint('functional', i)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFunctional}
                    onChange={(e) => setNewFunctional(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPainPoint('functional', newFunctional);
                      }
                    }}
                    placeholder="Can't fit pre-pregnancy clothes"
                    className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                  />
                  <button
                    type="button"
                    onClick={() => addPainPoint('functional', newFunctional)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted transition-all hover:border-electric/30 hover:text-electric"
                  >
                    <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M6 2v8M2 6h8" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Emotional */}
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Emotional
            </label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {localConcept.pain_points.emotional.map((item, i) => (
                  <PainPointPill
                    key={`e-${i}`}
                    value={item}
                    onChange={(val) => updatePainPoint('emotional', i, val)}
                    onBlur={() => handlePainPointBlur('emotional')}
                    onRemove={() => removePainPoint('emotional', i)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newEmotional}
                    onChange={(e) => setNewEmotional(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPainPoint('emotional', newEmotional);
                      }
                    }}
                    placeholder="Feeling like they've lost their identity"
                    className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                  />
                  <button
                    type="button"
                    onClick={() => addPainPoint('emotional', newEmotional)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted transition-all hover:border-electric/30 hover:text-electric"
                  >
                    <svg viewBox="0 0 12 12" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M6 2v8M2 6h8" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Unique Mechanism */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
            3
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Unique Mechanism
          </h3>
        </div>
        <textarea
          value={localConcept.unique_mechanism}
          onChange={(e) => updateUniqueM(e.target.value)}
          onBlur={() => autoSave(localConcept)}
          disabled={readOnly}
          placeholder="How does your product work differently from category defaults?"
          rows={4}
          className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {/* Section 4: Transformation */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
            4
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Transformation
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              Before
            </label>
            <textarea
              value={localConcept.transformation.before}
              onChange={(e) => updateTransformation('before', e.target.value)}
              onBlur={() => autoSave(localConcept)}
              disabled={readOnly}
              placeholder="Their current frustrated state..."
              rows={4}
              className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary">
              After
            </label>
            <textarea
              value={localConcept.transformation.after}
              onChange={(e) => updateTransformation('after', e.target.value)}
              onBlur={() => autoSave(localConcept)}
              disabled={readOnly}
              placeholder="Their desired state with emotional specificity..."
              rows={4}
              className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Hook Angle */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
            5
          </span>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Hook Angle
          </h3>
        </div>
        <input
          type="text"
          value={localConcept.hook_angle}
          onChange={(e) => updateHookAngle(e.target.value)}
          onBlur={() => autoSave(localConcept)}
          disabled={readOnly}
          placeholder="The one-line hook that stops the scroll..."
          className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3.5 text-base font-medium text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {/* Approve button */}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving}
            className="bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void rounded-lg transition-all hover:shadow-[0_0_20px_rgba(0,229,160,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approving ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-transparent border-t-void" />
                Approving...
              </span>
            ) : (
              'Approve & Generate Script'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/* ==============================
   Pain Point Pill Sub-component
   ============================== */

function PainPointPill({
  value,
  onChange,
  onBlur,
  onRemove,
  readOnly,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (readOnly) return;
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function finishEdit() {
    setEditing(false);
    onBlur();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={finishEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            finishEdit();
          }
        }}
        className="rounded-full border border-electric/40 bg-surface-raised px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-electric"
        style={{ minWidth: 120 }}
      />
    );
  }

  return (
    <span className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-xs text-text-primary transition-colors hover:border-border-bright">
      <span
        className={readOnly ? '' : 'cursor-pointer'}
        onClick={startEdit}
        role={readOnly ? undefined : 'button'}
        tabIndex={readOnly ? undefined : 0}
        onKeyDown={readOnly ? undefined : (e) => { if (e.key === 'Enter') startEdit(); }}
      >
        {value}
      </span>
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-text-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-magenta/20 hover:text-magenta"
        >
          <svg viewBox="0 0 8 8" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M1 1l6 6M7 1l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
}
