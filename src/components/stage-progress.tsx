'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ProgressData {
  stage: string;
  active: boolean;
  completed: number;
  total: number;
  generating: number;
  failed: number;
  label: string;
  currentStep: string;
  startedAt: string | null;
  costUsd: number;
}

// Expected max duration per stage (seconds) before showing warning
const STAGE_TIMEOUT: Record<string, number> = {
  casting: 300,     // 5 min
  directing: 1200,  // 20 min
  voiceover: 300,   // 5 min
  editing: 600,     // 10 min
};

interface StageProgressProps {
  projectId: string;
  stage: string;
  color?: 'electric' | 'magenta';
  onRetry?: () => void;
  onGoBack?: () => void;
  onCancel?: () => void;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function StageProgress({ projectId, stage, color = 'magenta', onRetry, onGoBack, onCancel }: StageProgressProps) {
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const failCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
        failCountRef.current = 0;
        setConnectionWarning(false);
        if (data.startedAt && !startTimeRef.current) {
          startTimeRef.current = new Date(data.startedAt).getTime();
        }
      } else {
        failCountRef.current++;
        if (failCountRef.current >= 5) setConnectionWarning(true);
      }
    } catch {
      failCountRef.current++;
      if (failCountRef.current >= 5) setConnectionWarning(true);
    }
  }, [projectId]);

  // Poll progress with exponential backoff on failure
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      await fetchProgress();
      if (cancelled) return;
      const delay = failCountRef.current > 0
        ? Math.min(3000 * Math.pow(2, failCountRef.current), 30000)
        : 3000;
      timeoutRef.current = setTimeout(poll, delay);
    }

    poll();
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchProgress]);

  // Update elapsed time every second (client-side)
  useEffect(() => {
    if (!progress?.startedAt) return;
    const start = new Date(progress.startedAt).getTime();

    function tick() {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [progress?.startedAt]);

  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const borderColor = color === 'electric' ? 'border-electric/20' : 'border-magenta/20';
  const bgColor = color === 'electric' ? 'bg-electric/5' : 'bg-magenta/5';
  const spinBorderTop = color === 'electric' ? 'border-t-electric' : 'border-t-magenta';
  const spinBorderBot = color === 'electric' ? 'border-b-electric-dim' : 'border-b-magenta/50';
  const textColor = color === 'electric' ? 'text-electric' : 'text-magenta';
  const barBg = color === 'electric' ? 'bg-electric/20' : 'bg-magenta/20';
  const barFill = color === 'electric' ? 'bg-electric' : 'bg-magenta';
  const barGlow = color === 'electric'
    ? 'shadow-[0_0_12px_rgba(0,240,255,0.4)]'
    : 'shadow-[0_0_12px_rgba(255,0,128,0.4)]';

  const stageLabels: Record<string, string> = {
    broll_planning: 'Planning B-Roll Shots',
    broll_generation: 'Generating B-Roll Images',
    casting: 'Generating Keyframes',
    directing: 'Generating Videos',
    voiceover: 'Generating Voiceovers',
    editing: 'Composing Final Video',
  };

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-6`}>
      <div className="flex items-start gap-4">
        {/* Spinner */}
        <div className="relative h-8 w-8 flex-shrink-0">
          <div className={`absolute inset-0 animate-spin rounded-full border-2 border-transparent ${spinBorderTop}`} />
          <div
            className={`absolute inset-1 animate-spin rounded-full border-2 border-transparent ${spinBorderBot}`}
            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3">
            <h3 className={`font-[family-name:var(--font-display)] text-sm font-semibold ${textColor}`}>
              {stageLabels[stage] || stage}
            </h3>
            <div className="flex items-center gap-3 flex-shrink-0">
              {progress && progress.costUsd > 0 && (
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                  ${progress.costUsd.toFixed(2)}
                </span>
              )}
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
                {formatElapsed(elapsed)}
              </span>
              {onCancel && (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={async () => {
                    setCancelling(true);
                    try { await onCancel(); } finally { setCancelling(false); }
                  }}
                  className="rounded border border-magenta/30 px-2 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-magenta/70 transition-colors hover:border-magenta/60 hover:bg-magenta/10 hover:text-magenta disabled:opacity-50"
                  title="Stop generation and go back"
                >
                  {cancelling ? (
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="25 10" /></svg>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg viewBox="0 0 10 10" fill="currentColor" className="h-2 w-2"><rect x="1" y="1" width="8" height="8" rx="1" /></svg>
                      Stop
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {progress && progress.total > 0 && (
            <div className="mt-3">
              <div className={`h-2 w-full overflow-hidden rounded-full ${barBg}`}>
                <div
                  className={`h-full rounded-full ${barFill} ${pct > 0 ? barGlow : ''} transition-all duration-700 ease-out`}
                  style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-text-secondary">
                  {progress.currentStep}
                </p>
                <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                  {progress.completed}/{progress.total}
                </span>
              </div>
            </div>
          )}

          {/* Fallback for stages with no progress data yet */}
          {(!progress || progress.total === 0) && (
            <p className="mt-1 text-sm text-text-secondary">
              {stage === 'casting' && 'Creating character keyframe images with Nano Banana Pro...'}
              {stage === 'broll_planning' && 'Analyzing script and generating B-roll shot list...'}
              {stage === 'broll_generation' && 'Creating B-roll images with Nano Banana Pro...'}
              {stage === 'directing' && 'Creating 10-second video segments with Kling 3.0 Pro...'}
              {stage === 'voiceover' && 'Creating voiceover audio with ElevenLabs...'}
              {stage === 'editing' && 'Composing final video...'}
            </p>
          )}

          {/* Warning for failed assets */}
          {progress && progress.failed > 0 && (
            <p className="mt-2 text-xs text-amber-hot">
              {progress.failed} asset{progress.failed > 1 ? 's' : ''} failed — agent will retry or skip
            </p>
          )}

          {/* Timeout warning for stuck pipelines */}
          {elapsed > (STAGE_TIMEOUT[stage] || 600) && (
            <div className="mt-3 rounded-lg border border-amber-hot/30 bg-amber-hot/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 flex-shrink-0 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 4.5v4" />
                  <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                </svg>
                <p className="text-[11px] text-amber-hot">
                  This stage is taking longer than expected. The worker may have crashed.
                </p>
              </div>
              {(onRetry || onGoBack) && (
                <div className="mt-2 flex items-center gap-2 pl-5">
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="rounded border border-amber-hot/40 bg-amber-hot/10 px-2.5 py-1 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-amber-hot transition-colors hover:bg-amber-hot/20"
                    >
                      Retry Stage
                    </button>
                  )}
                  {onGoBack && (
                    <button
                      type="button"
                      onClick={onGoBack}
                      className="rounded border border-border px-2.5 py-1 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:border-border-bright hover:text-text-secondary"
                    >
                      Go Back
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Connection warning after consecutive failures */}
          {connectionWarning && (
            <p className="mt-2 text-[11px] text-amber-hot/80">
              Connection issues — retrying...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
