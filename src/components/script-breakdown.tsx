'use client';

import { HighlightedText } from './highlighted-text';
import { analyzeSentencePacing } from '@/lib/syllables';

// ─── Types ────────────────────────────────────────────

interface BrollCue {
  shot_script_index: number;
  offset_seconds: number;
  duration_seconds: number;
  intent: string;
  spoken_text_during: string;
}

interface Scene {
  segment_index: number;
  section: string;
  script_text: string | null;
  syllable_count: number | null;
  energy_arc: { start: string; middle: string; end: string } | null;
  shot_scripts: { index: number; text: string; energy: string }[] | null;
  audio_sync: Record<string, { word: string; time: string; action: string }> | null;
  text_overlay: string | null;
  product_visibility: string | null;
  broll_cues: BrollCue[] | null;
}

interface SyllableTarget { min: number; max: number }
interface SyllableTargets {
  hook: SyllableTarget;
  problem: SyllableTarget;
  solution_product: SyllableTarget;
  cta: SyllableTarget;
}

interface ScriptBreakdownProps {
  scenes: Scene[];
  view: 'timeline' | 'beats';
  productTerms?: string[];
  syllableTargets?: SyllableTargets;
}

// ─── Constants ────────────────────────────────────────

const SECTION_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  Hook:                 { accent: 'text-magenta',   bg: 'bg-magenta/10',   border: 'border-magenta/30' },
  Problem:              { accent: 'text-amber-hot', bg: 'bg-amber-hot/10', border: 'border-amber-hot/30' },
  'Solution + Product': { accent: 'text-electric',  bg: 'bg-electric/10',  border: 'border-electric/30' },
  CTA:                  { accent: 'text-lime',      bg: 'bg-lime/10',      border: 'border-lime/30' },
};

const SECTION_HEX: Record<string, string> = {
  Hook: 'var(--color-magenta)',
  Problem: 'var(--color-amber-hot)',
  'Solution + Product': 'var(--color-electric)',
  CTA: 'var(--color-lime)',
};

const ENERGY_HEIGHT: Record<string, number> = {
  low: 25, medium: 50, 'medium-high': 75, high: 100, peak: 100,
};

const ENERGY_HEX: Record<string, string> = {
  low: 'var(--color-electric-dim)',
  medium: 'var(--color-electric)',
  'medium-high': 'var(--color-amber-hot)',
  high: 'var(--color-magenta)',
  peak: 'var(--color-magenta)',
};

const VISIBILITY_LABELS: Record<string, { label: string; opacity: number }> = {
  none:     { label: 'Hidden',  opacity: 0.3 },
  subtle:   { label: 'Subtle',  opacity: 0.5 },
  hero:     { label: 'Hero',    opacity: 1.0 },
  set_down: { label: 'In Frame', opacity: 0.7 },
};

// ─── Main Component ───────────────────────────────────

export function ScriptBreakdown({ scenes, view, productTerms, syllableTargets }: ScriptBreakdownProps) {
  const sorted = [...scenes].sort((a, b) => a.segment_index - b.segment_index);
  if (sorted.length === 0) return null;

  if (view === 'beats') return <BeatBoard scenes={sorted} productTerms={productTerms} syllableTargets={syllableTargets} />;
  return <TimelineView scenes={sorted} />;
}

// ═══════════════════════════════════════════════════════
// TIMELINE VIEW
// ═══════════════════════════════════════════════════════

function TimelineView({ scenes }: { scenes: Scene[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface p-5">
      <div className="min-w-[600px]">
        {/* Time markers */}
        <div className="mb-1 flex">
          <div className="w-20 flex-shrink-0" />
          <div className="relative flex flex-1">
            {[0, 15, 30, 45, 60].map((t) => (
              <span
                key={t}
                className="absolute font-[family-name:var(--font-mono)] text-[10px] text-text-muted"
                style={{ left: `${(t / 60) * 100}%`, transform: 'translateX(-50%)' }}
              >
                {t}s
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {/* Segment lane */}
          <Lane label="Segments">
            <div className="flex h-8">
              {scenes.map((s) => {
                const color = SECTION_HEX[s.section] || 'var(--color-border)';
                const colors = SECTION_COLORS[s.section];
                return (
                  <div
                    key={s.segment_index}
                    className={`flex flex-1 items-center justify-center border ${colors?.border || 'border-border'} ${colors?.bg || 'bg-surface-raised'}`}
                    style={{ borderBottom: `2px solid ${color}` }}
                  >
                    <span className={`font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase ${colors?.accent || 'text-text-muted'}`}>
                      {s.section}
                    </span>
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Energy arc lane */}
          <Lane label="Energy">
            <div className="flex h-10 items-end">
              {scenes.map((s) => {
                const arc = s.energy_arc;
                if (!arc) return <div key={s.segment_index} className="flex-1" />;
                const levels = [arc.start, arc.middle, arc.end].map((l) => l.toLowerCase());
                return (
                  <div key={s.segment_index} className="flex flex-1 items-end gap-px px-px">
                    {levels.map((level, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-all"
                        style={{
                          height: `${ENERGY_HEIGHT[level] || 25}%`,
                          backgroundColor: ENERGY_HEX[level] || 'var(--color-electric-dim)',
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Shot lane */}
          <Lane label="Shots">
            <div className="flex h-14">
              {scenes.map((s) => (
                <div key={s.segment_index} className="flex flex-1">
                  {(s.shot_scripts || []).map((shot, i) => (
                    <div
                      key={i}
                      className="flex flex-1 flex-col justify-center border-r border-border/30 px-1.5 last:border-r-0"
                    >
                      <span className="font-[family-name:var(--font-mono)] text-[9px] text-text-muted">
                        {s.segment_index * 3 + i + 1}
                      </span>
                      <span className="line-clamp-1 text-[10px] text-text-secondary">
                        {shot.text}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Lane>

          {/* B-roll cues lane */}
          <Lane label="B-Roll">
            <div className="relative flex h-8">
              {scenes.map((s) => {
                const cues = s.broll_cues || [];
                return (
                  <div key={s.segment_index} className="relative flex-1">
                    {cues.map((cue, i) => {
                      const left = (cue.offset_seconds / 15) * 100;
                      const width = Math.max((cue.duration_seconds / 15) * 100, 5);
                      return (
                        <div
                          key={i}
                          className="absolute top-1 flex h-6 items-center overflow-hidden rounded border border-summon/40 bg-summon/15 px-1"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`${cue.intent} — "${cue.spoken_text_during}"`}
                        >
                          <span className="truncate font-[family-name:var(--font-mono)] text-[8px] text-summon">
                            {cue.intent}
                          </span>
                        </div>
                      );
                    })}
                    {cues.length === 0 && (
                      <div className="flex h-full items-center justify-center">
                        <span className="font-[family-name:var(--font-mono)] text-[9px] text-text-muted/40">—</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Product visibility lane */}
          <Lane label="Product">
            <div className="flex h-7">
              {scenes.map((s) => {
                const vis = VISIBILITY_LABELS[s.product_visibility || 'none'] || VISIBILITY_LABELS.none;
                return (
                  <div
                    key={s.segment_index}
                    className="flex flex-1 items-center justify-center gap-1"
                    style={{ opacity: vis.opacity }}
                  >
                    <ProductIcon visibility={s.product_visibility || 'none'} />
                    <span className="font-[family-name:var(--font-mono)] text-[9px] text-text-secondary">
                      {vis.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Lane>

          {/* Text overlay lane */}
          <Lane label="Overlay">
            <div className="flex h-7">
              {scenes.map((s) => (
                <div key={s.segment_index} className="flex flex-1 items-center justify-center px-1">
                  <span className="truncate font-[family-name:var(--font-mono)] text-[9px] text-text-muted italic">
                    {s.text_overlay || '—'}
                  </span>
                </div>
              ))}
            </div>
          </Lane>

          {/* Audio sync peaks */}
          <Lane label="Peaks">
            <div className="flex h-7">
              {scenes.map((s) => {
                const sync = s.audio_sync;
                if (!sync) return <div key={s.segment_index} className="flex-1" />;
                const peaks = Object.values(sync);
                return (
                  <div key={s.segment_index} className="flex flex-1 items-center justify-around px-1">
                    {peaks.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-phoenix" />
                        <span className="font-[family-name:var(--font-mono)] text-[8px] text-phoenix">
                          {p.word}
                        </span>
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </Lane>
        </div>
      </div>
    </div>
  );
}

// ─── Lane wrapper ─────────────────────────────────────

function Lane({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex">
      <div className="flex w-20 flex-shrink-0 items-center">
        <span className="font-[family-name:var(--font-mono)] text-[9px] font-medium uppercase tracking-widest text-text-muted">
          {label}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Product visibility icon ──────────────────────────

function ProductIcon({ visibility }: { visibility: string }) {
  const cls = "h-3 w-3 text-text-secondary";
  if (visibility === 'none') {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        <path d="M2 2l12 12" />
        <path d="M6.5 6.5a2 2 0 002.8 2.8" />
        <path d="M3.5 5.5C2.5 6.5 1.5 7.5 1.5 8s3 4.5 6.5 4.5c1 0 2-.3 2.8-.7" />
        <path d="M10.5 10c1.2-.8 2.5-2 3-2.5 0 0-3-4.5-6.5-4.5-.5 0-1 .1-1.5.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cls} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 8s3-4.5 6.5-4.5S14.5 8 14.5 8s-3 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
// BEAT BOARD VIEW
// ═══════════════════════════════════════════════════════

function getSectionTarget(section: string, targets: SyllableTargets): SyllableTarget {
  const key = section.toLowerCase().replace(/\s*\+\s*/g, '_').replace(/\s+/g, '_');
  if (key === 'hook') return targets.hook;
  if (key === 'problem') return targets.problem;
  if (key.includes('solution')) return targets.solution_product;
  if (key === 'cta') return targets.cta;
  return { min: 75, max: 90 };
}

function syllableSummaryColor(total: number, target: SyllableTarget): string {
  if (total >= target.min && total <= target.max) return 'text-lime';
  const distance = total < target.min ? target.min - total : total - target.max;
  if (distance <= 10) return 'text-amber-hot';
  return 'text-magenta';
}

function sentenceBadgeColor(
  syllables: number,
  sentenceCount: number,
  target: SyllableTarget | undefined,
): string {
  if (!target || sentenceCount === 0) return 'bg-surface-overlay text-text-muted';
  const perSentenceMin = (target.min / sentenceCount) * 0.8;
  const perSentenceMax = (target.max / sentenceCount) * 1.2;
  if (syllables >= perSentenceMin && syllables <= perSentenceMax) return 'bg-lime/15 text-lime';
  const distLow = syllables < perSentenceMin ? perSentenceMin - syllables : 0;
  const distHigh = syllables > perSentenceMax ? syllables - perSentenceMax : 0;
  const dist = Math.max(distLow, distHigh);
  if (dist <= 5) return 'bg-amber-hot/15 text-amber-hot';
  return 'bg-magenta/15 text-magenta';
}

function BeatBoard({ scenes, productTerms, syllableTargets }: { scenes: Scene[]; productTerms?: string[]; syllableTargets?: SyllableTargets }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {scenes.map((s) => {
        const colors = SECTION_COLORS[s.section] || SECTION_COLORS.Hook;
        const brollCount = s.broll_cues?.length || 0;
        const vis = VISIBILITY_LABELS[s.product_visibility || 'none'] || VISIBILITY_LABELS.none;
        const shots = (s.shot_scripts || []).length;
        const pacing = s.script_text ? analyzeSentencePacing(s.script_text) : null;
        const sectionTarget = syllableTargets ? getSectionTarget(s.section, syllableTargets) : undefined;

        return (
          <div
            key={s.segment_index}
            className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}
          >
            {/* Header + syllable summary */}
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-overlay font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-muted">
                {s.segment_index + 1}
              </span>
              <h3 className={`font-[family-name:var(--font-display)] text-sm font-bold uppercase ${colors.accent}`}>
                {s.section}
              </h3>
              {pacing && sectionTarget && (
                <span className={`ml-1 font-[family-name:var(--font-mono)] text-[10px] font-semibold ${syllableSummaryColor(pacing.totalSyllables, sectionTarget)}`}>
                  {pacing.totalSyllables} / {sectionTarget.min}-{sectionTarget.max} syl
                </span>
              )}
              {pacing && !sectionTarget && (
                <span className="ml-1 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                  {pacing.totalSyllables} syl
                </span>
              )}
              <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {s.segment_index * 15}s &ndash; {(s.segment_index + 1) * 15}s
              </span>
            </div>

            {/* Mini energy arc */}
            {s.energy_arc && (
              <div className="mt-3 flex h-5 items-end gap-0.5">
                {[s.energy_arc.start, s.energy_arc.middle, s.energy_arc.end].map((level, i) => {
                  const l = level.toLowerCase();
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${ENERGY_HEIGHT[l] || 25}%`,
                        backgroundColor: ENERGY_HEX[l] || 'var(--color-electric-dim)',
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* Per-sentence breakdown */}
            {pacing && pacing.sentences.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {pacing.sentences.map((sentence, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 inline-flex h-[18px] min-w-[32px] flex-shrink-0 items-center justify-center rounded px-1 font-[family-name:var(--font-mono)] text-[9px] font-semibold ${sentenceBadgeColor(sentence.syllableCount, pacing.sentenceCount, sectionTarget)}`}
                    >
                      {sentence.syllableCount}
                    </span>
                    <span className="text-xs leading-relaxed text-text-secondary">
                      <HighlightedText text={sentence.text} terms={productTerms} productVisibility={s.product_visibility} />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Fallback when no script text */}
            {!pacing && s.script_text === null && (
              <p className="mt-3 text-xs italic text-text-muted">No script text</p>
            )}

            {/* Meta grid */}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {/* B-roll count */}
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-summon" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="10" rx="1.5" />
                  <circle cx="6" cy="8" r="1.5" />
                  <path d="M14 5l-4 3 4 3" />
                </svg>
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">
                  {brollCount} B-roll cue{brollCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Product visibility */}
              <div className="flex items-center gap-1.5" style={{ opacity: vis.opacity }}>
                <ProductIcon visibility={s.product_visibility || 'none'} />
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">
                  {vis.label}
                </span>
              </div>

              {/* Text overlay */}
              {s.text_overlay && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <rect x="2" y="4" width="12" height="8" rx="1" />
                    <line x1="5" y1="8" x2="11" y2="8" />
                    <line x1="5" y1="10" x2="9" y2="10" />
                  </svg>
                  <span className="truncate font-[family-name:var(--font-mono)] text-[10px] italic text-text-muted">
                    {s.text_overlay}
                  </span>
                </div>
              )}

              {/* Sentence & shot summary */}
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                  {pacing?.sentenceCount || '?'} sentences &middot; {shots} shots &middot; 15s
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
