import { CHARACTER_MAP, getCharacterForStatus } from './ff7-theme';

const REVIEW_GATES = new Set([
  'analysis_review', 'script_review', 'broll_review',
  'influencer_selection', 'casting_review', 'asset_review',
]);

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

interface PipelineProgressProps {
  status: string;
  failedAtStatus?: string | null;
  onStageClick?: (stageKey: string) => void;
  viewingStage?: string | null;
}

export function PipelineProgress({ status, failedAtStatus, onStageClick, viewingStage }: PipelineProgressProps) {
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
          const isViewing = viewingStage === stage.key;
          const isClickable = isCompleted && REVIEW_GATES.has(stage.key) && !!onStageClick;

          // Get character color for this stage
          const char = getCharacterForStatus(stage.key);
          const charColor = char?.color || CHARACTER_MAP.analyzing.color;

          // ATB bar fill + text styles
          let barFill = 'transparent';
          let barWidth = '0%';
          let textColor = 'text-text-muted';
          let barClass = '';
          let borderClass = 'border-border';

          if (isFailedStage) {
            barFill = '#ff2d55';
            barWidth = '100%';
            textColor = 'text-magenta';
            borderClass = 'border-magenta/40';
          } else if (isViewing) {
            barFill = '#00f0ff';
            barWidth = '100%';
            textColor = 'text-electric';
            borderClass = 'border-electric/50';
          } else if (isCompleted) {
            barFill = '#7aff6e';
            barWidth = '100%';
            textColor = 'text-lime';
            borderClass = 'border-lime/30';
          } else if (isCurrent && !isFailed) {
            barFill = charColor;
            barWidth = '70%';
            textColor = 'text-electric';
            borderClass = 'border-electric/40';
            barClass = 'animate-atb-fill';
          }

          return (
            <div key={stage.key} className="flex items-center">
              {/* ATB stage segment */}
              <div
                className={`flex flex-col items-center ${isClickable ? 'cursor-pointer' : ''}`}
                style={{ minWidth: 44 }}
                onClick={isClickable ? () => onStageClick(stage.key) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageClick(stage.key); } } : undefined}
              >
                {/* Mini ATB bar */}
                <div
                  className={`relative h-2 w-10 overflow-hidden rounded-sm border ${borderClass} bg-surface-overlay transition-all ${
                    isClickable ? 'hover:ring-1 hover:ring-lime/40' : ''
                  } ${isViewing ? 'ring-1 ring-electric/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]' : ''}`}
                >
                  <div
                    className={`h-full rounded-sm transition-all duration-500 ${barClass}`}
                    style={{
                      width: barWidth,
                      backgroundColor: barFill,
                      boxShadow: isViewing
                        ? '0 0 6px rgba(0,240,255,0.6)'
                        : isCurrent && !isFailed ? `0 0 6px ${charColor}60` : undefined,
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
                  className={`mt-1 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${textColor} ${isFuture ? 'opacity-40' : ''} ${isClickable ? 'hover:text-electric' : ''}`}
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
