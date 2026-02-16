'use client';

const ENERGY_Y: Record<string, number> = {
  low: 85,
  medium: 60,
  'medium-high': 35,
  high: 10,
  peak: 10,
};

const ENERGY_COLOR: Record<string, string> = {
  low: 'var(--color-electric-dim)',
  medium: 'var(--color-electric)',
  'medium-high': 'var(--color-amber-hot)',
  high: 'var(--color-magenta)',
  peak: 'var(--color-magenta)',
};

interface EnergyArcGraphProps {
  arcs: ({ start: string; middle: string; end: string } | null)[];
  sectionLabels?: string[];
}

export function EnergyArcGraph({ arcs, sectionLabels }: EnergyArcGraphProps) {
  // Flatten all arc points into a sequence: [s0.start, s0.mid, s0.end, s1.start, s1.mid, s1.end, ...]
  const points: { label: string; level: string; y: number }[] = [];
  for (let i = 0; i < arcs.length; i++) {
    const arc = arcs[i];
    if (!arc) continue;
    const prefix = sectionLabels?.[i] || `S${i + 1}`;
    const levels = [
      { label: `${prefix} start`, level: arc.start.toLowerCase() },
      { label: `${prefix} mid`, level: arc.middle.toLowerCase() },
      { label: `${prefix} end`, level: arc.end.toLowerCase() },
    ];
    for (const l of levels) {
      points.push({ ...l, y: ENERGY_Y[l.level] ?? 60 });
    }
  }

  if (points.length < 2) return null;

  const width = 280;
  const height = 100;
  const padX = 12;
  const padY = 8;
  const graphW = width - padX * 2;

  const step = graphW / (points.length - 1);
  const coords = points.map((p, i) => ({
    ...p,
    x: padX + i * step,
    y: padY + (p.y / 100) * (height - padY * 2),
  }));

  // Build polyline path
  const linePath = coords.map((c) => `${c.x},${c.y}`).join(' ');

  // Gradient fill area under the line
  const areaPath = `M${coords[0].x},${coords[0].y} ${coords.map((c) => `L${c.x},${c.y}`).join(' ')} L${coords[coords.length - 1].x},${height - padY} L${coords[0].x},${height - padY} Z`;

  // Segment dividers (between each segment's end and next segment's start)
  const dividers: number[] = [];
  for (let i = 2; i < coords.length - 1; i += 3) {
    const midX = (coords[i].x + coords[i + 1].x) / 2;
    dividers.push(midX);
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider text-text-muted">
          Energy Arc
        </span>
        <div className="flex items-center gap-2">
          {['low', 'medium', 'high'].map((level) => (
            <span key={level} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: ENERGY_COLOR[level] }}
              />
              <span className="font-[family-name:var(--font-mono)] text-[8px] text-text-muted capitalize">
                {level}
              </span>
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxWidth: width }}>
        {/* Gradient definition */}
        <defs>
          <linearGradient id="energy-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-electric)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-electric)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Segment dividers */}
        {dividers.map((x, i) => (
          <line
            key={i}
            x1={x}
            y1={padY}
            x2={x}
            y2={height - padY}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#energy-fill)" />

        {/* Line */}
        <polyline
          points={linePath}
          fill="none"
          stroke="var(--color-electric)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots at each point, colored by energy level */}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r="2.5"
            fill={ENERGY_COLOR[c.level] || 'var(--color-electric)'}
            stroke="var(--color-surface)"
            strokeWidth="1"
          />
        ))}

        {/* Segment labels at bottom */}
        {sectionLabels && sectionLabels.map((label, i) => {
          const startIdx = i * 3;
          if (startIdx + 1 >= coords.length) return null;
          const midIdx = startIdx + 1;
          return (
            <text
              key={i}
              x={coords[midIdx].x}
              y={height - 1}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize="7"
              fontFamily="var(--font-mono)"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
