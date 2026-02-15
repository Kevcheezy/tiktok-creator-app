'use client';

import { useState } from 'react';

interface ApproveControlsProps {
  projectId: string;
  scriptId: string;
  currentGrade: string | null;
  currentFeedback: string | null;
  onGradeChange?: (grade: string) => void;
  onApprove?: () => void;
  onRegenerate?: () => void;
}

const GRADES = [
  { value: 'S', label: 'S', color: 'bg-lime/10 text-lime border-lime/30 hover:bg-lime/20' },
  { value: 'A', label: 'A', color: 'bg-electric/10 text-electric border-electric/30 hover:bg-electric/20' },
  { value: 'B', label: 'B', color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30 hover:bg-amber-hot/20' },
  { value: 'F', label: 'F', color: 'bg-magenta/10 text-magenta border-magenta/30 hover:bg-magenta/20' },
];

export function ApproveControls({
  projectId,
  scriptId,
  currentGrade,
  currentFeedback,
  onGradeChange,
  onApprove,
  onRegenerate,
}: ApproveControlsProps) {
  const [grade, setGrade] = useState(currentGrade || '');
  const [feedback, setFeedback] = useState(currentFeedback || '');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function handleGrade(newGrade: string) {
    setGrade(newGrade);
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: newGrade }),
      });
      onGradeChange?.(newGrade);
    } catch (err) {
      console.error('Failed to save grade:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      // Save feedback if present
      if (feedback) {
        await fetch(`/api/projects/${projectId}/scripts/${scriptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        });
      }
      await fetch(`/api/projects/${projectId}/approve`, {
        method: 'POST',
      });
      onApprove?.();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setApproving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await fetch(`/api/projects/${projectId}/scripts/${scriptId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback || undefined }),
      });
      onRegenerate?.();
    } catch (err) {
      console.error('Failed to regenerate:', err);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Grade buttons */}
      <div>
        <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Grade Script
        </label>
        <div className="flex gap-2">
          {GRADES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => handleGrade(g.value)}
              disabled={saving}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border font-[family-name:var(--font-display)] text-sm font-bold transition-all ${
                grade === g.value
                  ? `${g.color} ring-1 ring-current`
                  : 'border-border bg-surface text-text-muted hover:border-border-bright hover:text-text-secondary'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div>
        <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Feedback
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional notes for regeneration..."
          rows={3}
          className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={approving || regenerating}
          className="flex-1 rounded-lg bg-lime px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {approving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
              </svg>
              Approving...
            </span>
          ) : (
            'Approve & Continue'
          )}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={approving || regenerating}
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-text-primary transition-all hover:border-magenta/40 hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          {regenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
              </svg>
              Regenerating...
            </span>
          ) : (
            'Regenerate'
          )}
        </button>
      </div>
    </div>
  );
}
