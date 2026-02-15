'use client';

import { useState, useEffect, useCallback } from 'react';

interface ScriptUploadProps {
  projectId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function ScriptUpload({ projectId, onSuccess, onClose }: ScriptUploadProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = text.length;
  const isValid = charCount >= 100 && charCount <= 5000;

  let countColor: string;
  if (charCount >= 100 && charCount <= 5000) {
    countColor = 'text-lime';
  } else if ((charCount >= 50 && charCount < 100) || (charCount > 5000 && charCount <= 5500)) {
    countColor = 'text-amber-hot';
  } else {
    countColor = 'text-magenta';
  }

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  async function handleSubmit() {
    if (!isValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to analyze script');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
            Upload Script
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted transition-colors hover:text-text-primary"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Paste your script text here..."
          className="block w-full resize-none rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />

        {/* Character count */}
        <div className="mt-2 flex justify-end">
          <span className={`font-[family-name:var(--font-mono)] text-xs ${countColor}`}>
            {charCount} / 5000 chars
          </span>
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || loading}
          className="mt-4 w-full rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,255,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
              </svg>
              Analyzing script structure...
            </span>
          ) : (
            'Analyze & Split'
          )}
        </button>

        {/* Error message */}
        {error && (
          <p className="mt-3 text-center text-sm text-magenta">{error}</p>
        )}
      </div>
    </div>
  );
}
