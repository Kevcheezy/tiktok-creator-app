'use client';

import { GilDisplay } from './gil-display';
import { FF7Sprite } from './ff7-sprite';
import { ATB_STAGES, CHARACTER_MAP, BATTLE_TEXT, REVIEW_GATES } from './ff7-theme';

interface BattleHUDProps {
  status: string;
  costUsd: string | null;
  failedAtStatus?: string | null;
  children: React.ReactNode;
}

function getCompletedStages(status: string, failedAtStatus?: string | null): string[] {
  const effectiveStatus = status === 'failed' && failedAtStatus ? failedAtStatus : status;
  const idx = ATB_STAGES.findIndex((s) => s.key === effectiveStatus);
  if (idx <= 0) return [];
  return ATB_STAGES.slice(0, idx).map((s) => s.key);
}

function getCurrentStage(status: string, failedAtStatus?: string | null): string | null {
  // If it's a review gate, map to its agent's ATB stage
  const agentKey = REVIEW_GATES[status];
  if (agentKey) return agentKey;
  // Direct ATB stages
  if (ATB_STAGES.some((s) => s.key === status)) return status;
  // Failed — show where it failed
  if (status === 'failed' && failedAtStatus) {
    const agentKeyF = REVIEW_GATES[failedAtStatus];
    if (agentKeyF) return agentKeyF;
    if (ATB_STAGES.some((s) => s.key === failedAtStatus)) return failedAtStatus;
  }
  return null;
}

function getProgress(status: string, failedAtStatus?: string | null): number {
  if (status === 'completed') return 100;
  const effectiveStatus = status === 'failed' && failedAtStatus ? failedAtStatus : status;

  // All pipeline stages (including review gates)
  const allStages = [
    'analyzing', 'analysis_review', 'scripting', 'script_review',
    'broll_planning', 'broll_review', 'broll_generation', 'influencer_selection',
    'casting', 'casting_review', 'directing', 'voiceover', 'asset_review', 'editing',
  ];
  const idx = allStages.indexOf(effectiveStatus);
  if (idx < 0) return 0;
  // Each completed stage fills progress proportionally
  const pctPerStage = 100 / allStages.length;
  return Math.min(100, Math.round(idx * pctPerStage));
}

/** FF7-style battle HUD overlay for project detail pages. */
export function BattleHUD({ status, costUsd, failedAtStatus, children }: BattleHUDProps) {
  const isVictory = status === 'completed';
  const isFailed = status === 'failed';
  const completed = getCompletedStages(status, failedAtStatus);
  const current = getCurrentStage(status, failedAtStatus);
  const progress = getProgress(status, failedAtStatus);

  return (
    <div className="relative">
      {/* Top HUD bar */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5">
        {/* Gil display */}
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Gil
          </span>
          <GilDisplay amount={costUsd} />
        </div>

        {/* Enemy HP bar */}
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {BATTLE_TEXT.enemyName}
          </span>
          <div className="relative h-2.5 w-32 overflow-hidden rounded-sm border border-magenta/30 bg-surface-overlay">
            <div
              className="h-full rounded-sm transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                backgroundColor: progress < 50 ? '#ff8c42' : progress < 80 ? '#ffc933' : '#33ff66',
              }}
            />
          </div>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-magenta">
            {progress}%
          </span>
        </div>
      </div>

      {/* Main content */}
      {children}

      {/* Party sprite row */}
      {(completed.length > 0 || current) && (
        <div className="mt-6 flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="mr-2 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Party
          </span>
          {completed.map((stageKey) => (
            <FF7Sprite
              key={stageKey}
              character={stageKey}
              state={isVictory ? 'attack' : 'idle'}
              size="sm"
            />
          ))}
          {current && CHARACTER_MAP[current] && (
            <FF7Sprite
              character={current}
              state={isFailed ? 'ko' : 'idle'}
              size="sm"
            />
          )}
        </div>
      )}
    </div>
  );
}
