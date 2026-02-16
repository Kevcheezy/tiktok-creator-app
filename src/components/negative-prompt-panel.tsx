'use client';

import { useState } from 'react';
import {
  resolveNegativePrompt,
  KLING_NEGATIVE_PROMPT,
  IMAGE_NEGATIVE_PROMPT,
} from '@/lib/prompt-schema';

interface NegativePromptPanelProps {
  projectId: string;
  negativePromptOverride: unknown;
  onSaved?: () => void;
  readOnly?: boolean;
}

type Stage = 'casting' | 'directing' | 'broll';

const TABS: { key: Stage; label: string; sublabel: string }[] = [
  { key: 'casting', label: 'Casting', sublabel: 'Images' },
  { key: 'directing', label: 'Directing', sublabel: 'Video' },
  { key: 'broll', label: 'B-Roll', sublabel: 'Images' },
];

function getDefaultForStage(stage: Stage): string {
  return stage === 'directing' ? KLING_NEGATIVE_PROMPT : IMAGE_NEGATIVE_PROMPT;
}

function getOverrideForStage(override: unknown, stage: Stage): string | null {
  if (!override) return null;
  if (typeof override === 'string') return override;
  if (typeof override === 'object' && override !== null) {
    const val = (override as Record<string, unknown>)[stage];
    if (typeof val === 'string') return val;
  }
  return null;
}

export function NegativePromptPanel({
  projectId,
  negativePromptOverride,
  onSaved,
  readOnly,
}: NegativePromptPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Stage>('directing');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const effectivePrompt = resolveNegativePrompt(
    { negative_prompt_override: negativePromptOverride },
    activeTab,
  );
  const stageOverride = getOverrideForStage(negativePromptOverride, activeTab);
  const hasOverride = stageOverride !== null;
  const defaultPrompt = getDefaultForStage(activeTab);

  function startEditing() {
    setDraft(effectivePrompt);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft('');
  }

  async function handleSave() {
    if (!draft.trim() || draft.trim() === defaultPrompt) {
      // If user set it back to default, treat as reset
      await handleReset();
      return;
    }
    setSaving(true);
    try {
      const existing =
        typeof negativePromptOverride === 'object' && negativePromptOverride
          ? { ...(negativePromptOverride as Record<string, string>) }
          : {};
      existing[activeTab] = draft.trim();
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negative_prompt_override: existing }),
      });
      setEditing(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      const existing =
        typeof negativePromptOverride === 'object' && negativePromptOverride
          ? { ...(negativePromptOverride as Record<string, string>) }
          : {};
      delete existing[activeTab];
      const value = Object.keys(existing).length > 0 ? existing : null;
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ negative_prompt_override: value }),
      });
      setEditing(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  function handleTabChange(tab: Stage) {
    setActiveTab(tab);
    setEditing(false);
    setDraft('');
  }

  return (
    <div className="glass rounded-lg">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3l2 1.5" />
          </svg>
          <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-secondary">
            Negative Prompts
          </span>
          {/* Count of active overrides */}
          {negativePromptOverride != null && (
            <span className="rounded-full bg-amber-hot/10 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold text-amber-hot">
              custom
            </span>
          )}
        </div>
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className={`h-3 w-3 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {/* Tab pills */}
          <div className="flex gap-1.5">
            {TABS.map((tab) => {
              const tabOverride = getOverrideForStage(negativePromptOverride, tab.key);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-[family-name:var(--font-display)] text-[11px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-electric/30 bg-electric/10 text-electric'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {tabOverride !== null && (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-hot" />
                  )}
                  {tab.label}
                  <span className="text-[9px] opacity-60">{tab.sublabel}</span>
                </button>
              );
            })}
          </div>

          {/* Status indicator */}
          <div className="mt-3 flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${hasOverride ? 'bg-amber-hot' : 'bg-electric'}`}
            />
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
              {hasOverride ? 'Custom override' : `Using default (${activeTab === 'directing' ? 'Kling 3.0 Pro' : 'Nano Banana Pro'})`}
            </span>
          </div>

          {/* Prompt display / editor */}
          {editing ? (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric/20 resize-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="font-[family-name:var(--font-display)] text-[10px] font-medium text-text-muted hover:text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md border border-electric/30 bg-electric/10 px-3 py-1 font-[family-name:var(--font-display)] text-[10px] font-semibold text-electric transition-colors hover:bg-electric/20 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-void/50 px-3 py-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-text-muted">
                {effectivePrompt}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {!readOnly && !editing && (
            <div className="mt-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={startEditing}
                className="rounded-md border border-border px-2.5 py-1 font-[family-name:var(--font-display)] text-[10px] font-medium text-text-secondary transition-colors hover:border-electric/30 hover:text-electric"
              >
                Customize
              </button>
              {hasOverride && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="font-[family-name:var(--font-display)] text-[10px] font-medium text-text-muted transition-colors hover:text-amber-hot disabled:opacity-50"
                >
                  {saving ? 'Resetting...' : 'Reset to Default'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
