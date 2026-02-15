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
}

interface StageProgressProps {
  projectId: string;
  stage: string;
  color?: 'electric' | 'magenta';
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export function StageProgress({ projectId, stage, color = 'magenta' }: StageProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/progress`);
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
        if (data.startedAt && !startTimeRef.current) {
          startTimeRef.current = new Date(data.startedAt).getTime();
        }
      }
    } catch {
      // silently fail
    }
  }, [projectId]);

  // Poll progress every 3 seconds
  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 3000);
    return () => clearInterval(interval);
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
            <span className="flex-shrink-0 font-[family-name:var(--font-mono)] text-xs text-text-muted">
              {formatElapsed(elapsed)}
            </span>
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
              {stage === 'directing' && 'Creating 15-second video segments with Kling 3.0 Pro...'}
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
        </div>
      </div>
    </div>
  );
}
