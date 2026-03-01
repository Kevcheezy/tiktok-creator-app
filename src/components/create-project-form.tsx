'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ToneSelector } from './tone-selector';

interface Product {
  id: string;
  name: string | null;
  url: string;
  status: string;
  category: string | null;
  image_url: string | null;
}

interface Influencer {
  id: string;
  name: string;
  persona: string | null;
}

interface Character {
  id: string;
  name: string;
  avatarPersona: string | null;
}

interface VideoModel {
  id: string;
  name: string;
  slug: string;
  provider: string;
  total_duration: number;
  segment_count: number;
  resolution: string;
  is_default: boolean;
}

interface StylePreset {
  id: string;
  name: string;
  total_score: number | null;
  status: string;
  patterns: {
    hook_technique?: string;
    pacing?: string;
    cta_formula?: string;
    product_integration_style?: string;
  } | null;
  transcript: {
    segments: Array<{
      index: number;
      section: string;
      text: string;
      start_time: number;
      end_time: number;
    }>;
  } | null;
  visual_style: {
    segments: Array<{
      scene: { setting: string; props: string[]; composition: string; productPresence: string };
      emotion: { mood: string; energy: string; pacing: string; viewerIntent: string };
      angle: { shotType: string; cameraMovement: string; transitions: string };
      lighting: { style: string; colorTemp: string; contrast: string };
    }>;
    overall: Record<string, unknown>;
  } | null;
  segment_scores: Record<string, Record<string, number>> | null;
}

export function CreateProjectForm() {
  const router = useRouter();
  const [productUrl, setProductUrl] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [inputMode, setInputMode] = useState<'existing' | 'new'>('new');
  const [videoUrl, setVideoUrl] = useState('');
  const [influencerId, setInfluencerId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [tone, setTone] = useState('reluctant-insider');
  const [products, setProducts] = useState<Product[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [videoModels, setVideoModels] = useState<VideoModel[]>([]);
  const [videoModelId, setVideoModelId] = useState('');
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [stylePresetId, setStylePresetId] = useState('');
  const [presetExpanded, setPresetExpanded] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Product[]) => setProducts(data.filter((p) => p.status === 'analyzed')))
      .catch(() => setProducts([]));
    fetch('/api/influencers')
      .then((res) => (res.ok ? res.json() : []))
      .then(setInfluencers)
      .catch(() => setInfluencers([]));
    fetch('/api/characters')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCharacters)
      .catch(() => setCharacters([]));
    fetch('/api/video-models')
      .then((res) => (res.ok ? res.json() : { videoModels: [] }))
      .then((data: { videoModels: VideoModel[] }) => {
        setVideoModels(data.videoModels);
        const defaultModel = data.videoModels.find((m) => m.is_default);
        if (defaultModel) setVideoModelId(defaultModel.id);
      })
      .catch(() => setVideoModels([]));
    fetch('/api/style-presets')
      .then((res) => (res.ok ? res.json() : { presets: [] }))
      .then((data: { presets: StylePreset[] }) => {
        setStylePresets((data.presets || []).filter((p) => p.status === 'ready'));
      })
      .catch(() => setStylePresets([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('productId');
    if (pid) {
      setInputMode('existing');
      setSelectedProductId(pid);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(inputMode === 'existing' && selectedProductId
            ? { productId: selectedProductId }
            : { productUrl }),
          videoUrl: videoUrl || undefined,
          influencerId: influencerId || undefined,
          characterId: characterId || undefined,
          videoModelId: videoModelId || undefined,
          stylePresetId: stylePresetId || undefined,
          tone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await res.json();
      router.refresh();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
          <p className="text-sm text-magenta">{error}</p>
        </div>
      )}

      {/* Product selector */}
      <div>
        <label className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary">
          Product <span className="text-magenta">*</span>
        </label>

        {/* Mode toggle tabs */}
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setInputMode('new');
              setSelectedProductId('');
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
              inputMode === 'new'
                ? 'bg-surface-raised text-electric border-electric/30'
                : 'bg-transparent text-text-muted border-border hover:text-text-secondary'
            }`}
          >
            New Product URL
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode('existing');
              setProductUrl('');
            }}
            disabled={products.length === 0}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
              inputMode === 'existing'
                ? 'bg-surface-raised text-electric border-electric/30'
                : 'bg-transparent text-text-muted border-border hover:text-text-secondary'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            Existing Product
          </button>
        </div>

        {/* New URL input */}
        {inputMode === 'new' && (
          <input
            type="url"
            id="productUrl"
            required
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://www.tiktok.com/shop/pdp/..."
            className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
          />
        )}

        {/* Existing product selector */}
        {inputMode === 'existing' && (
          <>
            <div className="relative">
              <select
                id="existingProduct"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-4 py-3 pr-10 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              >
                <option value="">Select an analyzed product...</option>
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name || prod.url}
                    {prod.category ? ` (${prod.category})` : ''}
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="4 6 8 10 12 6" />
              </svg>
            </div>

            {/* Product preview card */}
            {(() => {
              const selectedProduct = products.find((p) => p.id === selectedProductId);
              if (!selectedProduct) return null;
              return (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                  {selectedProduct.image_url && (
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name || 'Product'}
                      className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[family-name:var(--font-display)] text-sm font-medium text-text-primary">
                      {selectedProduct.name || 'Untitled Product'}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {selectedProduct.category && (
                        <span className="inline-flex rounded-md border border-electric/20 bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-display)] text-xs text-electric">
                          {selectedProduct.category}
                        </span>
                      )}
                      <span className="truncate font-[family-name:var(--font-mono)] text-xs text-text-muted">
                        {selectedProduct.url}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Video URL */}
      <div>
        <label
          htmlFor="videoUrl"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Reference Video URL{' '}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <input
          type="url"
          id="videoUrl"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@user/video/..."
          className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />
      </div>

      {/* Influencer */}
      <div>
        <label
          htmlFor="influencer"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Influencer{' '}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <div className="relative">
          <select
            id="influencer"
            value={influencerId}
            onChange={(e) => setInfluencerId(e.target.value)}
            className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-4 py-3 pr-10 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
          >
            <option value="">No influencer selected</option>
            {influencers.map((inf) => (
              <option key={inf.id} value={inf.id}>
                {inf.name}{inf.persona ? ` — ${inf.persona.split(/\s+/).slice(0, 4).join(' ')}` : ''}
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </div>
      </div>

      {/* Character */}
      <div>
        <label
          htmlFor="character"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Character{' '}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <div className="relative">
          <select
            id="character"
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-4 py-3 pr-10 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
          >
            <option value="">Auto-detect from product category</option>
            {characters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name} ({char.avatarPersona})
              </option>
            ))}
          </select>
          {/* Custom dropdown arrow */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </div>
      </div>

      {/* Video Model */}
      {videoModels.length > 0 && (
        <div>
          <label
            htmlFor="videoModel"
            className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
          >
            Video Model
          </label>
          <div className="relative">
            <select
              id="videoModel"
              value={videoModelId}
              onChange={(e) => setVideoModelId(e.target.value)}
              className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-4 py-3 pr-10 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            >
              {videoModels.map((vm) => (
                <option key={vm.id} value={vm.id}>
                  {vm.name} — {vm.total_duration}s, {vm.segment_count} segments, {vm.resolution}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>
          {(() => {
            const selected = videoModels.find((m) => m.id === videoModelId);
            if (!selected) return null;
            return (
              <p className="mt-1.5 font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                {selected.provider} · {selected.segment_count}×{selected.total_duration / selected.segment_count}s segments · {selected.resolution}
              </p>
            );
          })()}
        </div>
      )}

      {/* Script Tone */}
      <div>
        <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Script Tone
        </label>
        <ToneSelector value={tone} onChange={setTone} />
      </div>

      {/* Style Preset */}
      {stylePresets.length > 0 && (
        <div>
          <label
            htmlFor="stylePreset"
            className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
          >
            Style Preset{' '}
            <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <div className="relative">
            <select
              id="stylePreset"
              value={stylePresetId}
              onChange={(e) => {
                setStylePresetId(e.target.value);
                setPresetExpanded(false);
                setExpandedSegment(null);
              }}
              className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-4 py-3 pr-10 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            >
              <option value="">No style preset</option>
              {stylePresets.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}{sp.total_score !== null ? ` (${sp.total_score}/44)` : ''}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>

          {/* Preset summary + expand toggle */}
          {(() => {
            const selected = stylePresets.find((sp) => sp.id === stylePresetId);
            if (!selected) return null;

            const scoreKeys = ['hook', 'problem', 'solution', 'cta'] as const;
            const sectionLabels: Record<string, string> = { hook: 'Hook', problem: 'Problem', solution: 'Solution + Product', cta: 'CTA' };

            return (
              <div className="mt-3 space-y-3">
                {/* Pattern tags */}
                {selected.patterns && (
                  <div className="flex flex-wrap gap-2">
                    {selected.patterns.hook_technique && (
                      <span className="rounded-full bg-electric/10 px-2 py-0.5 text-[10px] text-electric">
                        {selected.patterns.hook_technique}
                      </span>
                    )}
                    {selected.patterns.pacing && (
                      <span className="rounded-full bg-phoenix/10 px-2 py-0.5 text-[10px] text-phoenix">
                        {selected.patterns.pacing}
                      </span>
                    )}
                    {selected.patterns.cta_formula && (
                      <span className="rounded-full bg-summon/10 px-2 py-0.5 text-[10px] text-summon">
                        {selected.patterns.cta_formula}
                      </span>
                    )}
                    {selected.patterns.product_integration_style && (
                      <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] text-lime">
                        {selected.patterns.product_integration_style}
                      </span>
                    )}
                  </div>
                )}

                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setPresetExpanded(!presetExpanded);
                    if (presetExpanded) setExpandedSegment(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-text-secondary transition-all hover:border-electric/30 hover:text-text-primary"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`h-3 w-3 transition-transform ${presetExpanded ? 'rotate-90' : ''}`}
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 4 10 8 6 12" />
                  </svg>
                  <span className="font-[family-name:var(--font-display)] font-medium">
                    {presetExpanded ? 'Hide details' : 'View preset details'}
                  </span>
                  {selected.transcript?.segments && (
                    <span className="text-text-muted">
                      ({selected.transcript.segments.length} segments)
                    </span>
                  )}
                </button>

                {/* Expanded detail panel */}
                {presetExpanded && (
                  <div className="space-y-2">
                    {(selected.transcript?.segments || []).map((seg, idx) => {
                      const scoreKey = scoreKeys[idx];
                      const scores = scoreKey && selected.segment_scores ? selected.segment_scores[scoreKey] : null;
                      const segTotal = scores?.total ?? null;
                      const segMax = scoreKey === 'hook' ? 14 : scoreKey === 'problem' ? 10 : scoreKey === 'solution' ? 10 : 10;
                      const visual = selected.visual_style?.segments?.[idx];
                      const isSegExpanded = expandedSegment === idx;

                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-border bg-void/50 overflow-hidden"
                        >
                          {/* Segment header */}
                          <button
                            type="button"
                            onClick={() => setExpandedSegment(isSegExpanded ? null : idx)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-raised/50"
                          >
                            <span className="shrink-0 rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase text-electric">
                              {sectionLabels[scoreKey] || seg.section}
                            </span>
                            <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                              {seg.start_time}s–{seg.end_time}s
                            </span>
                            {segTotal !== null && (
                              <span className="ml-auto font-[family-name:var(--font-mono)] text-[10px] text-summon">
                                {segTotal}/{segMax}
                              </span>
                            )}
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              className={`h-3 w-3 shrink-0 text-text-muted transition-transform ${isSegExpanded ? 'rotate-90' : ''}`}
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 4 10 8 6 12" />
                            </svg>
                          </button>

                          {/* Segment detail */}
                          {isSegExpanded && (
                            <div className="border-t border-border px-3 py-3 space-y-3">
                              {/* Transcript */}
                              <div>
                                <p className="mb-1 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                  Transcript
                                </p>
                                <p className="text-xs leading-relaxed text-text-secondary">
                                  {seg.text}
                                </p>
                              </div>

                              {/* Score breakdown */}
                              {scores && (
                                <div>
                                  <p className="mb-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                    Score Breakdown
                                  </p>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {Object.entries(scores)
                                      .filter(([k]) => k !== 'total')
                                      .map(([key, val]) => (
                                        <span key={key} className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-[10px]">
                                          <span className="text-text-muted">{key.replace(/_/g, ' ')}:</span>
                                          <span className={val >= 2 ? 'text-summon' : 'text-phoenix'}>{val}/2</span>
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Visual style */}
                              {visual && (
                                <div className="space-y-2">
                                  <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                    Visual Style
                                  </p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {/* Scene */}
                                    <div className="rounded-md border border-border bg-surface p-2">
                                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-electric">Scene</p>
                                      <p className="text-[10px] leading-snug text-text-secondary">{visual.scene.setting}</p>
                                      {visual.scene.productPresence && visual.scene.productPresence !== 'None' && (
                                        <p className="mt-1 text-[10px] text-summon">Product: {visual.scene.productPresence}</p>
                                      )}
                                    </div>
                                    {/* Emotion */}
                                    <div className="rounded-md border border-border bg-surface p-2">
                                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-phoenix">Emotion</p>
                                      <p className="text-[10px] leading-snug text-text-secondary">{visual.emotion.mood}</p>
                                      <p className="text-[10px] text-text-muted">Energy: {visual.emotion.energy}</p>
                                    </div>
                                    {/* Angle */}
                                    <div className="rounded-md border border-border bg-surface p-2">
                                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-summon">Angle</p>
                                      <p className="text-[10px] leading-snug text-text-secondary">{visual.angle.shotType}</p>
                                      <p className="text-[10px] text-text-muted">{visual.angle.cameraMovement}</p>
                                    </div>
                                    {/* Lighting */}
                                    <div className="rounded-md border border-border bg-surface p-2">
                                      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-lime">Lighting</p>
                                      <p className="text-[10px] leading-snug text-text-secondary">{visual.lighting.style}</p>
                                      <p className="text-[10px] text-text-muted">{visual.lighting.colorTemp} · {visual.lighting.contrast}</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="group relative w-full overflow-hidden rounded-lg bg-electric px-4 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(0,240,255,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
              <line x1="8" y1="3" x2="8" y2="13" />
              <line x1="3" y1="8" x2="13" y2="8" />
            </svg>
            Create Project
          </span>
        )}
      </button>
    </form>
  );
}
