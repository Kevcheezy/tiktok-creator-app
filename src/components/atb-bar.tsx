import { CHARACTER_MAP, type FF7Character } from './ff7-theme';
import { FF7Sprite } from './ff7-sprite';

type ATBState = 'waiting' | 'charging' | 'ready' | 'completed' | 'failed';

interface ATBBarProps {
  /** Pipeline stage key (e.g. 'analyzing', 'scripting') */
  stage: string;
  state: ATBState;
  /** 0-100 fill percentage for charging state */
  progress?: number;
  label?: string;
  className?: string;
}

export function ATBBar({ stage, state, progress = 0, label, className = '' }: ATBBarProps) {
  const char: FF7Character | undefined = CHARACTER_MAP[stage];
  const color = char?.color || '#555570';

  // State-specific styles
  const barStyles = {
    waiting: {
      trackBorder: 'border-border',
      fillColor: 'transparent',
      fillWidth: '0%',
      textColor: 'text-text-muted',
      barClass: '',
    },
    charging: {
      trackBorder: `border-[${color}]/30`,
      fillColor: color,
      fillWidth: `${Math.max(progress, 4)}%`,
      textColor: 'text-text-secondary',
      barClass: '',
    },
    ready: {
      trackBorder: 'border-gil/60',
      fillColor: '#ffc933',
      fillWidth: '100%',
      textColor: 'text-gil',
      barClass: 'animate-atb-ready',
    },
    completed: {
      trackBorder: 'border-lime/30',
      fillColor: '#7aff6e',
      fillWidth: '100%',
      textColor: 'text-lime',
      barClass: '',
    },
    failed: {
      trackBorder: 'border-magenta/30',
      fillColor: '#ff2d55',
      fillWidth: '100%',
      textColor: 'text-magenta',
      barClass: '',
    },
  };

  const s = barStyles[state];
  const spriteState = state === 'completed' ? 'attack' : state === 'failed' ? 'ko' : 'idle';
  const displayLabel = label || stage.replace('_', ' ');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Character sprite */}
      <FF7Sprite character={stage} state={spriteState} size="sm" />

      {/* Bar + label */}
      <div className="flex-1 min-w-0">
        <div
          className={`relative h-2.5 overflow-hidden rounded-sm border ${s.trackBorder} bg-surface-overlay ${s.barClass}`}
        >
          <div
            className="h-full rounded-sm transition-all duration-700 ease-out"
            style={{
              width: s.fillWidth,
              backgroundColor: s.fillColor,
              boxShadow: state === 'charging' ? `0 0 8px ${color}60` : undefined,
            }}
          />
        </div>
        <div className="mt-0.5 flex items-center justify-between">
          <span
            className={`font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-widest ${s.textColor} ${state === 'waiting' ? 'opacity-40' : ''}`}
          >
            {displayLabel}
          </span>
          <span className={`font-[family-name:var(--font-mono)] text-[9px] ${s.textColor}`}>
            {state === 'completed' && '✓'}
            {state === 'failed' && 'KO'}
            {state === 'ready' && 'YOUR TURN'}
            {state === 'charging' && `${progress}%`}
            {state === 'waiting' && '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
