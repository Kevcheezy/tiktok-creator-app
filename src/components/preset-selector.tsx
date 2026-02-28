'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Preset {
  id: string;
  title: string;
  description: string;
  category_affinity: string[];
  virality_notes?: string;
  is_default: boolean;
  is_custom: boolean;
  sort_order: number;
}

interface PresetSelectorProps {
  step: number;
  title: string;
  subtitle: string;
  presets: Preset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  productCategory: string | null;
  readOnly?: boolean;
  /** 'scene' | 'interaction' — determines the PATCH endpoint */
  presetType?: 'scene' | 'interaction';
  /** Called after a successful save so the parent can update its state */
  onPresetUpdate?: (updated: Preset) => void;
}

export type { Preset };

/** Pencil icon SVG used for the edit trigger */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
      <path d="M9.5 4.5l2 2" />
    </svg>
  );
}

export function PresetSelector({
  step,
  title,
  subtitle,
  presets,
  selectedId,
  onSelect,
  customText,
  onCustomTextChange,
  productCategory,
  readOnly,
  presetType,
  onPresetUpdate,
}: PresetSelectorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isCustomMode = customText.length > 0;

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editDraft]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  // Clean up saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft('');
    setSaveError(null);
  }, []);

  function startEdit(preset: Preset, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(preset.id);
    setEditDraft(preset.description);
    setSaveError(null);
    // Ensure the card is expanded while editing
    setExpandedId(preset.id);
  }

  async function handleSave(presetId: string) {
    if (!presetType || !onPresetUpdate) return;
    if (saving) return;

    const trimmed = editDraft.trim();
    if (!trimmed) {
      setSaveError('Description cannot be empty');
      return;
    }

    // Find current preset to check if description actually changed
    const current = presets.find((p) => p.id === presetId);
    if (current && current.description === trimmed) {
      // No change, just exit edit mode
      cancelEdit();
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/${presetType}-presets/${presetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to update (${res.status})`);
      }

      const updated = await res.json();
      onPresetUpdate(updated);
      setEditingId(null);
      setEditDraft('');

      // Show "Saved" feedback briefly
      setSavedId(presetId);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent, presetId: string) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
    // Cmd/Ctrl+Enter to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave(presetId);
    }
  }

  function handleCardClick(presetId: string) {
    if (readOnly) return;
    // Don't toggle selection while editing
    if (editingId === presetId) return;
    if (selectedId === presetId) {
      setExpandedId(expandedId === presetId ? null : presetId);
    } else {
      onSelect(presetId);
      onCustomTextChange('');
      setExpandedId(null);
    }
  }

  function handleCustomFocus() {
    if (readOnly) return;
    onSelect(null);
  }

  function isBestMatch(preset: Preset): boolean {
    if (!productCategory) return false;
    const cat = productCategory.toLowerCase();
    return preset.category_affinity.some((a) => cat.includes(a.toLowerCase()) || a.toLowerCase().includes(cat));
  }

  const canEdit = !!presetType && !!onPresetUpdate && !readOnly;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* Step header */}
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">
          {step}
        </span>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric">
          {title}
        </h2>
        <span className="text-xs text-text-muted">&mdash; {subtitle}</span>
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map((preset) => {
          const isSelected = selectedId === preset.id && !isCustomMode;
          const isExpanded = expandedId === preset.id;
          const bestMatch = isBestMatch(preset);
          const isEditing = editingId === preset.id;
          const justSaved = savedId === preset.id;

          return (
            <div
              key={preset.id}
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(preset.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(preset.id);
                }
              }}
              className={`group relative rounded-lg border-2 p-3 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-electric bg-electric/5 ring-1 ring-electric/30'
                  : readOnly
                    ? 'border-border/50 bg-surface-raised opacity-50 cursor-not-allowed'
                    : 'border-border bg-surface-raised hover:border-border-bright hover:bg-surface-overlay'
              }`}
            >
              {/* Best match badge */}
              {bestMatch && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-amber-hot/15 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-amber-hot">
                  <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                    <polygon points="6,0 7.5,4 12,4.5 8.5,7.5 9.5,12 6,9.5 2.5,12 3.5,7.5 0,4.5 4.5,4" />
                  </svg>
                  Best match
                </span>
              )}

              {/* Title row with edit pencil */}
              <div className="flex items-center gap-1.5">
                <p className="flex-1 font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                  {preset.title}
                  {preset.is_default && (
                    <span className="ml-1 font-normal text-text-muted">(default)</span>
                  )}
                </p>

                {/* Edit pencil — visible on hover or when selected, hidden while editing */}
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={(e) => startEdit(preset, e)}
                    title="Edit description"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-all ${
                      isSelected
                        ? 'text-electric/60 hover:text-electric hover:bg-electric/10'
                        : 'text-text-muted/0 group-hover:text-text-muted/50 hover:!text-electric hover:bg-electric/10'
                    }`}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}

                {/* "Saved" feedback */}
                {justSaved && !isEditing && (
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[9px] font-medium text-lime">
                    Saved
                  </span>
                )}
              </div>

              {/* Description — show textarea in edit mode, text otherwise */}
              {isEditing ? (
                <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    ref={textareaRef}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, preset.id)}
                    rows={2}
                    className="block w-full resize-none overflow-hidden rounded border border-border-bright bg-void px-2 py-1.5 text-[11px] leading-relaxed text-text-primary placeholder:text-text-muted/40 transition-colors focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric/40"
                    placeholder="Enter preset description..."
                  />

                  {/* Error message */}
                  {saveError && (
                    <p className="mt-1 text-[10px] text-magenta">{saveError}</p>
                  )}

                  {/* Save / Cancel buttons */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave(preset.id);
                      }}
                      disabled={saving}
                      className="rounded bg-lime/90 px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold text-void transition-all hover:bg-lime disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                      disabled={saving}
                      className="rounded bg-surface-overlay px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-muted transition-all hover:bg-border hover:text-text-secondary disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <span className="ml-auto text-[9px] text-text-muted/40">
                      Esc / {'\u2318'}Enter
                    </span>
                  </div>
                </div>
              ) : (
                <p className={`mt-1 text-[11px] leading-relaxed text-text-muted ${isExpanded || isEditing ? '' : 'line-clamp-2'}`}>
                  {preset.description}
                </p>
              )}

              {/* Virality notes (expanded only, not while editing) */}
              {isExpanded && !isEditing && preset.virality_notes && (
                <p className="mt-1.5 text-[10px] italic text-summon">
                  {preset.virality_notes}
                </p>
              )}

              {/* Selection checkmark */}
              {isSelected && (
                <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-electric">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-void" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3.5 8 6.5 11 12.5 5" />
                  </svg>
                </div>
              )}

              {/* Expand hint */}
              {isSelected && !isExpanded && !isEditing && (
                <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[9px] text-text-muted/60">
                  Click again to expand
                </p>
              )}
            </div>
          );
        })}

        {/* Custom override card */}
        <button
          type="button"
          onClick={handleCustomFocus}
          disabled={readOnly}
          className={`rounded-lg border-2 border-dashed p-3 text-left transition-all ${
            isCustomMode
              ? 'border-electric bg-electric/5'
              : readOnly
                ? 'border-border/50 bg-surface-raised opacity-50 cursor-not-allowed'
                : 'border-border-bright bg-surface-raised hover:border-electric/50 hover:bg-surface-overlay'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-text-muted" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-secondary">
              Custom
            </p>
          </div>
          <p className="mt-1 text-[11px] text-text-muted">
            Write your own description
          </p>
        </button>
      </div>

      {/* Custom textarea (visible when custom mode active) */}
      {isCustomMode && (
        <div className="mt-3">
          <textarea
            value={customText}
            onChange={(e) => onCustomTextChange(e.target.value)}
            disabled={readOnly}
            rows={3}
            placeholder="Describe the scene or interaction in detail..."
            className="block w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric resize-none disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
