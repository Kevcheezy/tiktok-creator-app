import { CHARACTER_MAP, getCharacterForStatus } from './ff7-theme';

const STAGES = [
  { key: 'analyzing', label: 'Analyze' },
  { key: 'analysis_review', label: 'Review' },
  { key: 'scripting', label: 'Script' },
  { key: 'script_review', label: 'Review' },
  { key: 'broll_planning', label: 'B-Roll' },
  { key: 'broll_review', label: 'Review' },
  { key: 'broll_generation', label: 'Generate' },
  { key: 'influencer_selection', label: 'Select' },
  { key: 'casting', label: 'Cast' },
  { key: 'casting_review', label: 'Review' },
  { key: 'directing', label: 'Direct' },
  { key: 'voiceover', label: 'Voice' },
  { key: 'asset_review', label: 'Review' },
  { key: 'editing', label: 'Edit' },
  { key: 'completed', label: 'Done' },
] as const;

function getStageIndex(status: string): number {
  const idx = STAGES.findIndex((s) => s.key === status);
  // 'created' is before all stages, 'failed' should show where it failed
  if (status === 'created') return -1;
  if (status === 'failed') return -2;
  return idx;
}

export function PipelineProgress({ status, failedAtStatus }: { status: string; failedAtStatus?: string | null }) {
  const isFailed = status === 'failed';
  const effectiveStatus = isFailed && failedAtStatus ? failedAtStatus : status;
  const currentIndex = getStageIndex(effectiveStatus);
  const failedIndex = isFailed && failedAtStatus ? getStageIndex(failedAtStatus) : -1;

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-0 min-w-max">
        {STAGES.map((stage, i) => {
          const isCompleted = currentIndex > i;
          const isCurrent = currentIndex === i;
          const isFailedStage = failedIndex === i && isFailed;
          const isFuture = !isCompleted && !isCurrent;

          // Get character color for this stage
          const char = getCharacterForStatus(stage.key);
          const charColor = char?.color || CHARACTER_MAP.analyzing.color;

          // ATB bar fill + text styles
          let barFill = 'transparent';
          let barWidth = '0%';
          let textColor = 'text-text-muted';
          let barClass = '';

          if (isFailedStage) {
            barFill = '#ff2d55';
            barWidth = '100%';
            textColor = 'text-magenta';
          } else if (isCompleted) {
            barFill = '#7aff6e';
            barWidth = '100%';
            textColor = 'text-lime';
          } else if (isCurrent && !isFailed) {
            barFill = charColor;
            barWidth = '70%';
            textColor = 'text-electric';
            barClass = 'animate-atb-fill';
          }

          return (
            <div key={stage.key} className="flex items-center">
              {/* ATB stage segment */}
              <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                {/* Mini ATB bar */}
                <div
                  className={`relative h-2 w-10 overflow-hidden rounded-sm border ${
                    isFailedStage
                      ? 'border-magenta/40'
                      : isCompleted
                        ? 'border-lime/30'
                        : isCurrent && !isFailed
                          ? 'border-electric/40'
                          : 'border-border'
                  } bg-surface-overlay`}
                >
                  <div
                    className={`h-full rounded-sm transition-all duration-500 ${barClass}`}
                    style={{
                      width: barWidth,
                      backgroundColor: barFill,
                      boxShadow: isCurrent && !isFailed ? `0 0 6px ${charColor}60` : undefined,
                    }}
                  />
                  {/* Pulsing indicator for current stage */}
                  {isCurrent && !isFailed && (
                    <div
                      className="absolute inset-0 animate-materia-pulse rounded-sm"
                      style={{ backgroundColor: charColor, opacity: 0.15 }}
                    />
                  )}
                </div>
                {/* Stage label */}
                <span
                  className={`mt-1 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${textColor} ${isFuture ? 'opacity-40' : ''}`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector */}
              {i < STAGES.length - 1 && (
                <div
                  className={`mx-0.5 h-0.5 w-3 rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-lime/40' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
