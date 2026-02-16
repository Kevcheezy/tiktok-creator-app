'use client';

import { CHARACTER_MAP, getCharacterForStatus, type FF7Character } from './ff7-theme';

interface FF7SpriteProps {
  /** Pipeline stage key (e.g. 'analyzing', 'scripting') or status (e.g. 'script_review') */
  character: string;
  state?: 'idle' | 'attack' | 'ko';
  size?: 'sm' | 'md' | 'lg';
  /** When provided, renders an <img> inside the pixel frame */
  src?: string;
  className?: string;
}

const SIZES = {
  sm: { box: 24, font: 8, border: 1 },
  md: { box: 40, font: 13, border: 2 },
  lg: { box: 64, font: 20, border: 2 },
} as const;

export function FF7Sprite({ character, state = 'idle', size = 'md', src, className = '' }: FF7SpriteProps) {
  const charData: FF7Character | null = CHARACTER_MAP[character] || getCharacterForStatus(character);
  const { box, font, border } = SIZES[size];

  const fallbackColor = '#555570';
  const color = charData?.color || fallbackColor;
  const initials = charData?.initials || '??';

  // State-based animation class
  const stateClass =
    state === 'attack' ? 'animate-attack-flash' :
    state === 'ko' ? 'animate-ko-spin' :
    'animate-float';

  // Ko desaturation
  const koStyle = state === 'ko' ? { filter: 'grayscale(0.7) brightness(0.6)' } : {};

  // Pixel-art stepped box-shadow for retro border feel
  const pixelShadow = `${border}px ${border}px 0 ${color}40, -${border}px -${border}px 0 ${color}20`;

  return (
    <div
      className={`relative inline-flex flex-shrink-0 items-center justify-center ${stateClass} ${className}`}
      style={{
        width: box,
        height: box,
        border: `${border}px solid ${color}`,
        backgroundColor: `${color}18`,
        boxShadow: pixelShadow,
        imageRendering: 'pixelated',
        ...koStyle,
      }}
      title={charData?.name || character}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={charData?.name || character}
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span
          className="select-none font-[family-name:var(--font-mono)] font-bold leading-none"
          style={{ fontSize: font, color }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
