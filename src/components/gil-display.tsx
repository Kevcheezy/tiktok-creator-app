import { formatGil } from './ff7-theme';

interface GilDisplayProps {
  amount: number | string | null | undefined;
  className?: string;
}

/** Inline Gil coin + amount. Replaces bare "$X.XX" cost displays. */
export function GilDisplay({ amount, className = '' }: GilDisplayProps) {
  const formatted = formatGil(amount);
  if (formatted === '0.00') return null;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {/* Gil coin SVG */}
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 flex-shrink-0"
        fill="none"
      >
        <circle cx="8" cy="8" r="7" fill="#ffc933" stroke="#b8941f" strokeWidth="1" />
        <circle cx="8" cy="8" r="5" fill="none" stroke="#b8941f" strokeWidth="0.5" opacity="0.5" />
        <text
          x="8"
          y="11"
          textAnchor="middle"
          fill="#8a6d14"
          fontSize="8"
          fontWeight="bold"
          fontFamily="monospace"
        >
          G
        </text>
      </svg>
      <span className="font-[family-name:var(--font-mono)] text-[11px] text-gil">
        {formatted}
      </span>
    </span>
  );
}
