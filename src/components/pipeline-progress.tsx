const STAGES = [
  { key: 'analyzing', label: 'Analyze' },
  { key: 'analysis_review', label: 'Review' },
  { key: 'scripting', label: 'Script' },
  { key: 'script_review', label: 'Review' },
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
  // When failed, show progress up to the failed stage
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

          let dotColor = 'bg-surface-overlay border-border';
          let textColor = 'text-text-muted';
          let lineColor = 'bg-border';

          if (isFailedStage) {
            dotColor = 'bg-magenta/20 border-magenta';
            textColor = 'text-magenta';
          } else if (isCompleted) {
            dotColor = 'bg-lime/20 border-lime';
            textColor = 'text-lime';
            lineColor = 'bg-lime/40';
          } else if (isCurrent && !isFailed) {
            dotColor = 'bg-electric/20 border-electric';
            textColor = 'text-electric';
          }

          return (
            <div key={stage.key} className="flex items-center">
              {/* Stage node */}
              <div className="flex flex-col items-center">
                <div
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 ${dotColor}`}
                >
                  {isFailedStage ? (
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-magenta" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="5" y1="5" x2="11" y2="11" />
                      <line x1="11" y1="5" x2="5" y2="11" />
                    </svg>
                  ) : isCompleted ? (
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className="h-3.5 w-3.5 text-lime"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3.5 8 6.5 11 12.5 5" />
                    </svg>
                  ) : isCurrent && !isFailed ? (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-electric opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-electric" />
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted/40" />
                  )}
                </div>
                <span
                  className={`mt-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider ${textColor} ${isFuture ? 'opacity-50' : ''}`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STAGES.length - 1 && (
                <div
                  className={`mx-1 h-0.5 w-8 rounded-full transition-all duration-300 ${lineColor}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
