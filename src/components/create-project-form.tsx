'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ToneSelector } from './tone-selector';

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

export function CreateProjectForm() {
  const router = useRouter();
  const [productUrl, setProductUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [influencerId, setInfluencerId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [tone, setTone] = useState('reluctant-insider');
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/influencers')
      .then((res) => (res.ok ? res.json() : []))
      .then(setInfluencers)
      .catch(() => setInfluencers([]));
    fetch('/api/characters')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCharacters)
      .catch(() => setCharacters([]));
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
          productUrl,
          videoUrl: videoUrl || undefined,
          influencerId: influencerId || undefined,
          characterId: characterId || undefined,
          tone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await res.json();
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

      {/* Product URL */}
      <div>
        <label
          htmlFor="productUrl"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Product URL <span className="text-magenta">*</span>
        </label>
        <input
          type="url"
          id="productUrl"
          required
          value={productUrl}
          onChange={(e) => setProductUrl(e.target.value)}
          placeholder="https://www.tiktok.com/shop/pdp/..."
          className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />
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
                {inf.name}{inf.persona ? ` (${inf.persona})` : ''}
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

      {/* Script Tone */}
      <div>
        <label className="mb-2 block font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Script Tone
        </label>
        <ToneSelector value={tone} onChange={setTone} />
      </div>

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
