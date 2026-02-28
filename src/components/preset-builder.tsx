'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { EnergyArcGraph } from './energy-arc-graph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranscriptSegment {
  index: number;
  section: string;
  text: string;
  start_time: number;
  end_time: number;
}

interface SegmentScores {
  hook: Record<string, number>;
  problem: Record<string, number>;
  solution: Record<string, number>;
  cta: Record<string, number>;
}

interface Patterns {
  hook_technique: string;
  energy_arc: Record<string, { start: string; middle: string; end: string }>;
  product_integration_style: string;
  cta_formula: string;
  pacing: string;
}

interface StylePresetFull {
  id: string;
  name: string;
  video_url: string | null;
  status: 'analyzing' | 'ready' | 'failed';
  categories: string[];
  total_score: number | null;
  transcript: {
    full_text: string;
    segments: TranscriptSegment[];
  } | null;
  segment_scores: SegmentScores | null;
  patterns: Patterns | null;
  visual_style: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

// Scoring criteria definitions: segment -> criteria list with max 2 each
const SEGMENT_CRITERIA: Record<string, string[]> = {
  hook: [
    'curiosity_loop',
    'challenges_belief',
    'clear_context',
    'plants_question',
    'pattern_interrupt',
    'emotional_trigger',
    'specific_claim',
  ],
  problem: [
    'relatability',
    'pain_amplification',
    'credibility',
    'emotional_depth',
    'transition_setup',
  ],
  solution: [
    'product_integration',
    'proof_evidence',
    'transformation_narrative',
    'differentiation',
    'authenticity',
  ],
  cta: [
    'urgency',
    'value_stack',
    'social_proof',
    'clear_action',
    'scarcity_exclusivity',
  ],
};

const SEGMENT_MAX_SCORES: Record<string, number> = {
  hook: 14,
  problem: 10,
  solution: 10,
  cta: 10,
};

const SEGMENT_LABELS: Record<string, string> = {
  hook: 'Hook',
  problem: 'Problem',
  solution: 'Solution + Product',
  cta: 'CTA',
};

// ---------------------------------------------------------------------------
// Score dot component
// ---------------------------------------------------------------------------

function ScoreDot({ value, label }: { value: number; label: string }) {
  const colorClass =
    value === 2
      ? 'text-lime'
      : value === 1
        ? 'text-gil'
        : 'text-text-muted';
  const bgClass =
    value === 2
      ? 'bg-lime'
      : value === 1
        ? 'bg-gil'
        : 'bg-surface-raised';

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        <div
          className={`h-2.5 w-2.5 rounded-full ${value >= 1 ? bgClass : 'bg-surface-raised'}`}
        />
        <div
          className={`h-2.5 w-2.5 rounded-full ${value >= 2 ? bgClass : 'bg-surface-raised'}`}
        />
      </div>
      <span
        className={`font-[family-name:var(--font-mono)] text-[11px] ${colorClass}`}
      >
        {label.replace(/_/g, ' ')}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment score card
// ---------------------------------------------------------------------------

function SegmentScoreCard({
  segmentKey,
  scores,
}: {
  segmentKey: string;
  scores: Record<string, number>;
}) {
  const criteria = SEGMENT_CRITERIA[segmentKey] || [];
  const total = scores.total ?? 0;
  const maxScore = SEGMENT_MAX_SCORES[segmentKey] ?? 10;
  const pct = Math.min((total / maxScore) * 100, 100);
  const ringColor =
    pct >= 75 ? 'text-lime' : pct >= 50 ? 'text-gil' : 'text-text-muted';

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h4 className="font-[family-name:var(--font-display)] text-sm font-bold text-text-primary">
          {SEGMENT_LABELS[segmentKey] || segmentKey}
        </h4>
        <span
          className={`font-[family-name:var(--font-mono)] text-lg font-bold ${ringColor}`}
        >
          {total}
          <span className="text-xs text-text-muted">/{maxScore}</span>
        </span>
      </div>

      {/* Score bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct >= 75
              ? 'bg-lime/60'
              : pct >= 50
                ? 'bg-gil/60'
                : 'bg-text-muted/30'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Per-criteria scores */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {criteria.map((key) => (
          <ScoreDot key={key} value={scores[key] ?? 0} label={key} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PresetBuilder component
// ---------------------------------------------------------------------------

export function PresetBuilder() {
  const router = useRouter();

  // Phase 1: Input form state
  const [name, setName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [categories, setCategories] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Phase 2: Analysis state
  const [presetId, setPresetId] = useState<string | null>(null);
  const [preset, setPreset] = useState<StylePresetFull | null>(null);
  const [pollError, setPollError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Polling logic
  const startPolling = useCallback(
    (id: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      async function poll() {
        try {
          const res = await fetch(`/api/style-presets/${id}`);
          if (!res.ok) {
            setPollError('Failed to fetch preset status');
            return;
          }
          const data = await res.json();
          const p = data.preset as StylePresetFull;
          setPreset(p);

          if (p.status !== 'analyzing') {
            // Stop polling
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {
          setPollError('Network error while checking status');
        }
      }

      // Immediate first poll
      poll();
      pollRef.current = setInterval(poll, 3000);
    },
    [],
  );

  // Phase 1: Submit handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');

    try {
      const categoryList = categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch('/api/style-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          videoUrl: videoUrl.trim(),
          categories: categoryList.length > 0 ? categoryList : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create preset');
      }

      const data = await res.json();
      const id = data.preset.id;
      setPresetId(id);
      setPreset({
        id,
        name: data.preset.name,
        status: 'analyzing',
        video_url: videoUrl.trim(),
        categories: [],
        total_score: null,
        transcript: null,
        segment_scores: null,
        patterns: null,
        visual_style: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      });
      startPolling(id);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong',
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Retry handler for failed analysis
  async function handleRetry() {
    if (!presetId) return;
    setRetrying(true);
    setPollError('');

    try {
      // Delete the failed preset and re-create
      await fetch(`/api/style-presets/${presetId}`, { method: 'DELETE' });

      const categoryList = categories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await fetch('/api/style-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          videoUrl: videoUrl.trim(),
          categories: categoryList.length > 0 ? categoryList : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to retry');
      }

      const data = await res.json();
      const newId = data.preset.id;
      setPresetId(newId);
      setPreset({
        id: newId,
        name: data.preset.name,
        status: 'analyzing',
        video_url: videoUrl.trim(),
        categories: [],
        total_score: null,
        transcript: null,
        segment_scores: null,
        patterns: null,
        visual_style: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      });
      startPolling(newId);
    } catch (err) {
      setPollError(
        err instanceof Error ? err.message : 'Retry failed',
      );
    } finally {
      setRetrying(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Input form
  // ---------------------------------------------------------------------------
  if (!presetId) {
    return (
      <div className="animate-fade-in-up rounded-xl border border-border bg-surface p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
              <p className="text-sm text-magenta">{submitError}</p>
            </div>
          )}

          {/* Preset name */}
          <div>
            <label
              htmlFor="preset-name"
              className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
            >
              Preset Name <span className="text-magenta">*</span>
            </label>
            <input
              type="text"
              id="preset-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-energy supplement review"
              className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            />
          </div>

          {/* Video URL */}
          <div>
            <label
              htmlFor="video-url"
              className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
            >
              TikTok Video URL <span className="text-magenta">*</span>
            </label>
            <input
              type="url"
              id="video-url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            />
            <p className="mt-1.5 text-[11px] text-text-muted">
              Paste the full URL of a winning TikTok video you want to analyze
            </p>
          </div>

          {/* Categories (optional) */}
          <div>
            <label
              htmlFor="categories"
              className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
            >
              Categories{' '}
              <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <input
              type="text"
              id="categories"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              placeholder="supplements, skincare, fitness"
              className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            />
            <p className="mt-1.5 text-[11px] text-text-muted">
              Comma-separated categories to help match this preset to products
            </p>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="group relative w-full overflow-hidden rounded-lg bg-electric px-5 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(0,240,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="60"
                    strokeDashoffset="15"
                    strokeLinecap="round"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className="h-4 w-4"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <polygon points="3,2 13,8 3,14" fill="currentColor" stroke="none" />
                </svg>
                Analyze Video
              </span>
            )}
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Analysis in progress
  // ---------------------------------------------------------------------------
  if (preset?.status === 'analyzing') {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          {/* Pulsing indicator */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-electric/30" />
              <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            </div>
          </div>

          <h3 className="mt-6 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            Analyzing video...
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            Downloading, transcribing, and scoring the video. This typically
            takes 30-60 seconds.
          </p>

          {/* Progress steps */}
          <div className="mx-auto mt-6 max-w-xs space-y-2">
            {[
              'Downloading video',
              'Transcribing audio',
              'Segmenting transcript',
              'Scoring criteria',
              'Extracting patterns',
            ].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 text-left"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-electric animate-pulse" />
                <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted">
                  {step}
                </span>
              </div>
            ))}
          </div>

          {pollError && (
            <div className="mt-4 rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
              <p className="text-sm text-magenta">{pollError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Failed
  // ---------------------------------------------------------------------------
  if (preset?.status === 'failed') {
    return (
      <div className="animate-fade-in-up space-y-6">
        <div className="rounded-xl border border-magenta/30 bg-surface p-8 text-center">
          {/* Error icon */}
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-magenta/10">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-magenta"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>

          <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-semibold text-text-primary">
            Analysis Failed
          </h3>
          {preset.error_message && (
            <p className="mt-2 text-sm text-magenta">
              {preset.error_message}
            </p>
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)] disabled:opacity-50"
            >
              {retrying ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="60"
                      strokeDashoffset="15"
                      strokeLinecap="round"
                    />
                  </svg>
                  Retrying...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 8a6 6 0 0111.47-2.47" />
                    <path d="M14 8a6 6 0 01-11.47 2.47" />
                    <polyline points="2 2 2 6 6 6" />
                    <polyline points="14 14 14 10 10 10" />
                  </svg>
                  Retry Analysis
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/presets')}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
            >
              Back to Presets
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Ready — show results
  // ---------------------------------------------------------------------------
  if (preset?.status === 'ready') {
    const energyArcs: ({ start: string; middle: string; end: string } | null)[] =
      [];
    if (preset.patterns?.energy_arc) {
      for (let i = 0; i < 4; i++) {
        const key = `segment_${i}`;
        const arc = preset.patterns.energy_arc[key];
        if (arc && typeof arc === 'object' && 'start' in arc) {
          energyArcs.push(arc as { start: string; middle: string; end: string });
        } else {
          energyArcs.push(null);
        }
      }
    }

    return (
      <div className="animate-fade-in-up space-y-6">
        {/* Header with score */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-text-primary">
                {preset.name}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Analysis complete
              </p>
            </div>
            <div className="text-right">
              <span className="font-[family-name:var(--font-mono)] text-3xl font-bold text-lime">
                {preset.total_score}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-sm text-text-muted">
                /44
              </span>
              <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-text-muted">
                Total Score
              </p>
            </div>
          </div>
        </div>

        {/* Transcript section */}
        {preset.transcript && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-electric">
              Transcript
            </h3>

            {/* Full text */}
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              {preset.transcript.full_text}
            </p>

            {/* Segments */}
            <div className="mt-4 space-y-3">
              {preset.transcript.segments.map((seg) => {
                const sectionColors: Record<string, string> = {
                  Hook: 'border-electric/40 bg-electric/5',
                  Problem: 'border-phoenix/40 bg-phoenix/5',
                  'Solution + Product': 'border-lime/40 bg-lime/5',
                  CTA: 'border-summon/40 bg-summon/5',
                };
                const labelColors: Record<string, string> = {
                  Hook: 'text-electric',
                  Problem: 'text-phoenix',
                  'Solution + Product': 'text-lime',
                  CTA: 'text-summon',
                };

                return (
                  <div
                    key={seg.index}
                    className={`rounded-lg border p-3 ${sectionColors[seg.section] || 'border-border bg-surface-raised'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider ${labelColors[seg.section] || 'text-text-primary'}`}
                      >
                        {seg.section}
                      </span>
                      <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                        {seg.start_time}s - {seg.end_time}s
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                      {seg.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scoring section */}
        {preset.segment_scores && (
          <div>
            <h3 className="mb-3 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-electric">
              Segment Scores
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['hook', 'problem', 'solution', 'cta'] as const).map(
                (key) => {
                  const scores = preset.segment_scores?.[key];
                  if (!scores) return null;
                  return (
                    <SegmentScoreCard
                      key={key}
                      segmentKey={key}
                      scores={scores}
                    />
                  );
                },
              )}
            </div>
          </div>
        )}

        {/* Patterns section */}
        {preset.patterns && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wider text-electric">
              Patterns
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Hook technique */}
              <div>
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Hook Technique
                </span>
                <p className="mt-1">
                  <span className="inline-flex rounded-full bg-electric/10 px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-electric">
                    {preset.patterns.hook_technique.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>

              {/* Product integration */}
              <div>
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Product Integration
                </span>
                <p className="mt-1">
                  <span className="inline-flex rounded-full bg-phoenix/10 px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-phoenix">
                    {preset.patterns.product_integration_style.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>

              {/* CTA formula */}
              <div>
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  CTA Formula
                </span>
                <p className="mt-1">
                  <span className="inline-flex rounded-full bg-summon/10 px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-summon">
                    {preset.patterns.cta_formula.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>

              {/* Pacing */}
              <div>
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Pacing Style
                </span>
                <p className="mt-1">
                  <span className="inline-flex rounded-full bg-gil/10 px-3 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-gil">
                    {preset.patterns.pacing.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>
            </div>

            {/* Energy arc visualization */}
            {energyArcs.some((a) => a !== null) && (
              <div className="mt-4">
                <EnergyArcGraph
                  arcs={energyArcs}
                  sectionLabels={['Hook', 'Problem', 'Solution', 'CTA']}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
          <button
            type="button"
            onClick={() => router.push('/presets')}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="8" x2="4" y2="8" />
              <polyline points="8 4 4 8 8 12" />
            </svg>
            Back to Presets
          </button>

          <button
            type="button"
            onClick={() => router.push('/presets')}
            className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3.5 8 6.5 11 12.5 5" />
            </svg>
            Save Preset
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
