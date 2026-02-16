'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uploadToStorage } from './direct-upload';

export function InfluencerForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Upload image directly to storage if present
      let storagePath: string | undefined;
      if (imageFile) {
        const tempId = crypto.randomUUID();
        const result = await uploadToStorage(imageFile, 'influencer', tempId);
        storagePath = result.path;
      }

      // Create influencer via JSON (not FormData)
      const res = await fetch('/api/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          persona: persona || undefined,
          storagePath,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create influencer');
      }

      router.push('/influencers');
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

      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Name <span className="text-magenta">*</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah Chen"
          className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />
      </div>

      {/* Persona */}
      <div>
        <label
          htmlFor="persona"
          className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary"
        >
          Persona{' '}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          id="persona"
          rows={3}
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="Describe who this influencer is, their style, niche, tone of voice..."
          className="block w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric resize-none"
        />
      </div>

      {/* Reference Photo */}
      <div>
        <label className="mb-2 block font-[family-name:var(--font-display)] text-sm font-medium text-text-primary">
          Reference Photo{' '}
          <span className="font-normal text-text-muted">(optional)</span>
        </label>

        {imagePreview ? (
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-raised">
            <img
              src={imagePreview}
              alt="Preview"
              className="mx-auto max-h-64 object-contain"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute right-2 top-2 rounded-lg bg-void/80 p-1.5 text-text-secondary transition-colors hover:bg-void hover:text-magenta"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="h-4 w-4"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-border-bright bg-surface-raised px-4 py-8 text-center transition-all hover:border-electric/50 hover:bg-surface-overlay"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-overlay">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 text-text-muted"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 15l-4.5-4.5c-.83-.83-2.17-.83-3 0L6 18" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-secondary">
                Click to upload a reference photo
              </p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                JPEG, PNG, or WebP
              </p>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="hidden"
        />
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
            Create Influencer
          </span>
        )}
      </button>
    </form>
  );
}
