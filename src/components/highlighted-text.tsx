'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

const VISIBILITY_INFO: Record<string, { label: string; description: string; color: string }> = {
  none:     { label: 'Hidden',   description: 'Product not visible in this segment', color: 'text-text-muted' },
  subtle:   { label: 'Subtle',   description: 'Product shown briefly or in background', color: 'text-amber-hot' },
  hero:     { label: 'Hero',     description: 'Product is the focal point of the frame', color: 'text-electric' },
  set_down: { label: 'In Frame', description: 'Product placed visibly in the scene', color: 'text-lime' },
};

interface HighlightedTextProps {
  text: string;
  terms?: string[];
  productVisibility?: string | null;
}

export function HighlightedText({ text, terms, productVisibility }: HighlightedTextProps) {
  const [popoverIdx, setPopoverIdx] = useState<number | null>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (popoverIdx === null) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverIdx(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popoverIdx]);

  // Build regex from terms, filtering out empty/short terms
  const pattern = useMemo(() => {
    if (!terms || terms.length === 0) return null;
    const filtered = terms
      .filter((t) => t.length >= 3)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (filtered.length === 0) return null;
    return new RegExp(`(${filtered.join('|')})`, 'gi');
  }, [terms]);

  if (!pattern) return <>{text}</>;

  // Split text into segments: alternating non-match / match
  const parts = text.split(pattern);
  const vis = VISIBILITY_INFO[productVisibility || 'none'] || VISIBILITY_INFO.none;

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = pattern.test(part);
        pattern.lastIndex = 0; // reset regex state
        if (!isMatch) return <span key={i}>{part}</span>;

        return (
          <span key={i} className="relative inline">
            <button
              type="button"
              onClick={() => setPopoverIdx(popoverIdx === i ? null : i)}
              className="cursor-pointer rounded-sm bg-electric/15 px-0.5 font-semibold text-electric underline decoration-electric/40 decoration-dotted underline-offset-2 transition-colors hover:bg-electric/25 hover:text-electric"
            >
              {part}
            </button>
            {popoverIdx === i && (
              <span
                ref={popoverRef}
                className="absolute bottom-full left-1/2 z-50 mb-2 w-52 -translate-x-1/2 rounded-lg border border-electric/20 bg-surface-raised p-3 shadow-lg shadow-black/40"
              >
                <span className="mb-1.5 flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" fill="none" className={`h-3.5 w-3.5 ${vis.color}`} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 8s3-4.5 6.5-4.5S14.5 8 14.5 8s-3 4.5-6.5 4.5S1.5 8 1.5 8z" />
                    <circle cx="8" cy="8" r="2" />
                  </svg>
                  <span className={`font-[family-name:var(--font-display)] text-xs font-bold ${vis.color}`}>
                    {vis.label}
                  </span>
                </span>
                <span className="block font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-text-secondary">
                  {vis.description}
                </span>
                <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-electric/20 bg-surface-raised" />
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
