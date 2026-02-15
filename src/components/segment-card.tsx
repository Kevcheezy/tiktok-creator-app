interface Scene {
  id: string;
  script_id: string;
  segment_index: number;
  section: string;
  script_text: string | null;
  syllable_count: number | null;
  energy_arc: { start: string; middle: string; end: string } | null;
  shot_scripts: { index: number; text: string; energy: string }[] | null;
  audio_sync: Record<string, { word: string; time: string; action: string }> | null;
  text_overlay: string | null;
  product_visibility: string | null;
  created_at: string;
}

const SECTION_COLORS: Record<string, { accent: string; bg: string; label: string }> = {
  Hook: { accent: 'text-magenta', bg: 'bg-magenta/10 border-magenta/20', label: 'Hook' },
  Problem: { accent: 'text-amber-hot', bg: 'bg-amber-hot/10 border-amber-hot/20', label: 'Problem' },
  'Solution + Product': { accent: 'text-electric', bg: 'bg-electric/10 border-electric/20', label: 'Solution + Product' },
  CTA: { accent: 'text-lime', bg: 'bg-lime/10 border-lime/20', label: 'CTA' },
};

const ENERGY_LEVELS: Record<string, { width: string; color: string }> = {
  low: { width: 'w-1/4', color: 'bg-electric-dim' },
  medium: { width: 'w-1/2', color: 'bg-electric' },
  'medium-high': { width: 'w-3/4', color: 'bg-amber-hot' },
  high: { width: 'w-full', color: 'bg-magenta' },
};

function SyllableIndicator({ count }: { count: number | null }) {
  if (count === null) return null;

  let status: 'good' | 'warn' | 'error';
  let color: string;

  if (count >= 82 && count <= 90) {
    status = 'good';
    color = 'text-lime';
  } else if (count >= 75 && count <= 95) {
    status = 'warn';
    color = 'text-amber-hot';
  } else {
    status = 'error';
    color = 'text-magenta';
  }

  return (
    <span className={`inline-flex items-center gap-1 font-[family-name:var(--font-mono)] text-xs ${color}`}>
      {count} syl
      {status === 'good' && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <polyline points="2.5 6 5 8.5 9.5 3.5" />
        </svg>
      )}
      {status === 'warn' && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="6" y1="3" x2="6" y2="7" />
          <circle cx="6" cy="9.5" r="0.5" fill="currentColor" />
        </svg>
      )}
      {status === 'error' && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
      )}
    </span>
  );
}

function EnergyArc({ arc }: { arc: { start: string; middle: string; end: string } }) {
  const levels = [
    { label: 'Start', value: arc.start },
    { label: 'Mid', value: arc.middle },
    { label: 'End', value: arc.end },
  ];

  return (
    <div className="flex items-end gap-2">
      {levels.map((l) => {
        const config = ENERGY_LEVELS[l.value.toLowerCase()] || { width: 'w-1/3', color: 'bg-text-muted' };
        return (
          <div key={l.label} className="flex-1">
            <div className="mb-1 h-8 overflow-hidden rounded bg-surface-overlay">
              <div
                className={`h-full ${config.color} transition-all duration-500`}
                style={{ width: config.width === 'w-1/4' ? '25%' : config.width === 'w-1/2' ? '50%' : config.width === 'w-3/4' ? '75%' : '100%' }}
              />
            </div>
            <span className="block text-center font-[family-name:var(--font-mono)] text-[9px] uppercase text-text-muted">
              {l.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SegmentCard({ scene }: { scene: Scene }) {
  const sectionConfig = SECTION_COLORS[scene.section] || {
    accent: 'text-text-secondary',
    bg: 'bg-surface-overlay border-border',
    label: scene.section,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-border-bright">
      {/* Header */}
      <div className={`flex items-center justify-between border-b px-4 py-3 ${sectionConfig.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider ${sectionConfig.accent}`}>
            {sectionConfig.label}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
            Seg {scene.segment_index + 1}
          </span>
        </div>
        <SyllableIndicator count={scene.syllable_count} />
      </div>

      <div className="space-y-4 p-4">
        {/* Script text */}
        {scene.script_text && (
          <div>
            <p className="text-sm leading-relaxed text-text-primary">
              &ldquo;{scene.script_text}&rdquo;
            </p>
          </div>
        )}

        {/* Energy Arc */}
        {scene.energy_arc && (
          <div>
            <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Energy Arc
            </h4>
            <EnergyArc arc={scene.energy_arc} />
          </div>
        )}

        {/* Shot Scripts */}
        {scene.shot_scripts && scene.shot_scripts.length > 0 && (
          <div>
            <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Shot Scripts
            </h4>
            <div className="space-y-2">
              {scene.shot_scripts.map((shot) => {
                const energyConfig = ENERGY_LEVELS[shot.energy.toLowerCase()] || { color: 'bg-text-muted' };
                return (
                  <div
                    key={shot.index}
                    className="flex items-start gap-3 rounded-lg bg-surface-raised px-3 py-2"
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-surface-overlay font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-muted">
                      {shot.index}
                    </span>
                    <p className="flex-1 text-xs leading-relaxed text-text-secondary">
                      {shot.text}
                    </p>
                    <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${energyConfig.color}`} title={shot.energy} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Text Overlay */}
        {scene.text_overlay && (
          <div>
            <h4 className="mb-1 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Text Overlay
            </h4>
            <div className="rounded-lg border border-dashed border-border-bright bg-surface-overlay px-3 py-2">
              <p className="font-[family-name:var(--font-display)] text-xs font-medium text-text-primary">
                {scene.text_overlay}
              </p>
            </div>
          </div>
        )}

        {/* Audio Sync */}
        {scene.audio_sync && Object.keys(scene.audio_sync).length > 0 && (
          <div>
            <h4 className="mb-1 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Audio Sync
            </h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(scene.audio_sync).map(([key, sync]) => (
                <span
                  key={key}
                  className="rounded bg-surface-overlay px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-muted"
                  title={`${sync.time}: ${sync.action}`}
                >
                  {sync.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
