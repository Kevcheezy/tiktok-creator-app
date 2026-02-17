'use client';

import { useState, useRef } from 'react';
import { GilDisplay } from './gil-display';
import { DownloadButton } from './download-button';
import { downloadViaProxy } from '@/lib/download-utils';
import { serializeForImage } from '@/lib/prompt-serializer';
import { isStructuredPrompt, type StructuredPrompt } from '@/lib/prompt-schema';

interface AssetCardProps {
  asset: {
    id: string;
    type: string;
    url: string | null;
    status: string;
    provider: string | null;
    cost_usd: string | null;
    grade: string | null;
    metadata: Record<string, unknown> | null;
    scene: { segment_index: number; section: string; visual_prompt: { start: string; end: string } | null } | null;
  };
  showGrade?: boolean;
  compact?: boolean;
  onGrade?: (assetId: string, grade: string) => void;
  onReject?: (assetId: string) => void;
  onRegenerate?: (assetId: string) => void;
  onEdit?: (assetId: string) => void;
  /** Filename for the download button. When provided, a download icon appears on completed assets. */
  downloadFilename?: string;
  /** When set, downloads use the backend proxy endpoint instead of fetch-and-blob. Use for large files (videos). */
  proxyDownload?: { projectId: string };
  onCancelAsset?: (assetId: string) => void;
  /** Called when user selects a file to upload as replacement for this asset. */
  onUploadAsset?: (assetId: string, file: File) => void;
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  keyframe_start: { label: 'Start', color: 'bg-electric/10 text-electric border-electric/30' },
  keyframe_end: { label: 'End', color: 'bg-electric/10 text-electric border-electric/30' },
  video: { label: 'Video', color: 'bg-magenta/10 text-magenta border-magenta/30' },
  audio: { label: 'Audio', color: 'bg-lime/10 text-lime border-lime/30' },
};

const GRADES = [
  { value: 'S', color: 'bg-lime/10 text-lime border-lime/30 hover:bg-lime/20' },
  { value: 'A', color: 'bg-electric/10 text-electric border-electric/30 hover:bg-electric/20' },
  { value: 'B', color: 'bg-amber-hot/10 text-amber-hot border-amber-hot/30 hover:bg-amber-hot/20' },
  { value: 'F', color: 'bg-magenta/10 text-magenta border-magenta/30 hover:bg-magenta/20' },
];

/** Asset types that support user file upload replacement */
const UPLOADABLE_TYPES = new Set(['keyframe_start', 'keyframe_end', 'video', 'broll']);

/** Returns the accept attribute value for the file input based on asset type */
function getUploadAccept(assetType: string): string {
  if (assetType === 'video') return 'video/mp4,video/webm';
  return 'image/jpeg,image/png,image/webp';
}

// ─── Structured Prompt Display ────────────────────────────────────────────────
// Renders a StructuredPrompt as labeled key-value sections inside the popover.

function PromptLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider text-summon/80">
      {children}
    </span>
  );
}

function PromptValue({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-mono)] text-[10px] leading-snug text-text-secondary">
      {children}
    </span>
  );
}

function StructuredPromptDisplay({ prompt }: { prompt: StructuredPrompt }) {
  const sections: { label: string; content: React.ReactNode }[] = [];

  // Subject
  if (prompt.subject) {
    const parts: string[] = [];
    if (prompt.subject.primary) parts.push(prompt.subject.primary);
    if (prompt.subject.features) parts.push(prompt.subject.features);
    if (prompt.subject.wardrobe) parts.push(prompt.subject.wardrobe);
    if (parts.length > 0) {
      sections.push({ label: 'Subject', content: parts.join(' · ') });
    }
  }

  // Environment
  if (prompt.environment) {
    const parts: string[] = [];
    if (prompt.environment.setting) parts.push(prompt.environment.setting);
    if (prompt.environment.elements?.length) {
      parts.push(prompt.environment.elements.join(', '));
    }
    if (prompt.environment.product_visible && prompt.environment.product_position) {
      parts.push(`product: ${prompt.environment.product_position}`);
    }
    if (parts.length > 0) {
      sections.push({ label: 'Environment', content: parts.join(' · ') });
    }
  }

  // Product
  if (prompt.product && (prompt.product.emphasis || prompt.product.position)) {
    const parts: string[] = [];
    if (prompt.product.emphasis) parts.push(prompt.product.emphasis);
    if (prompt.product.position) parts.push(prompt.product.position);
    sections.push({ label: 'Product', content: parts.join(' · ') });
  }

  // Lighting
  if (prompt.lighting) {
    const parts: string[] = [];
    if (prompt.lighting.type) parts.push(prompt.lighting.type);
    if (prompt.lighting.quality) parts.push(prompt.lighting.quality);
    if (prompt.lighting.details) parts.push(prompt.lighting.details);
    if (parts.length > 0) {
      sections.push({ label: 'Lighting', content: parts.join(' · ') });
    }
  }

  // Camera
  if (prompt.camera_specs) {
    const parts: string[] = [];
    if (prompt.camera_specs.shot) parts.push(prompt.camera_specs.shot);
    if (prompt.camera_specs.movement) parts.push(prompt.camera_specs.movement);
    if (prompt.camera_specs.framing) parts.push(prompt.camera_specs.framing);
    if (parts.length > 0) {
      sections.push({ label: 'Camera', content: parts.join(' · ') });
    }
  }

  // Style
  if (prompt.style) {
    const parts: string[] = [];
    if (prompt.style.aesthetic) parts.push(prompt.style.aesthetic);
    if (prompt.style.quality) parts.push(prompt.style.quality);
    if (prompt.style.skin) parts.push(prompt.style.skin);
    if (parts.length > 0) {
      sections.push({ label: 'Style', content: parts.join(' · ') });
    }
  }

  // Action
  if (prompt.action) {
    const actionContent = (
      <span>
        {prompt.action.energy_arc && (
          <span className="text-electric/70">{prompt.action.energy_arc}</span>
        )}
        {prompt.action.sequence?.length > 0 && (
          <>
            {prompt.action.energy_arc && <br />}
            {prompt.action.sequence.map((step, i) => (
              <span key={i} className="block">
                <span className="text-text-muted">{step.time}</span>{' '}
                {step.action}
                {step.energy && <span className="text-amber-hot/60"> [{step.energy}]</span>}
              </span>
            ))}
          </>
        )}
      </span>
    );
    sections.push({ label: 'Action', content: actionContent });
  }

  // Dialogue
  if (prompt.dialogue && (prompt.dialogue.text || prompt.dialogue.delivery)) {
    const parts: string[] = [];
    if (prompt.dialogue.text) parts.push(`"${prompt.dialogue.text}"`);
    if (prompt.dialogue.delivery) parts.push(prompt.dialogue.delivery);
    sections.push({ label: 'Dialogue', content: parts.join(' — ') });
  }

  // Negative prompt (dimmed)
  if (prompt.negative_prompt) {
    sections.push({
      label: 'Negative',
      content: (
        <span className="text-text-muted/60">{prompt.negative_prompt}</span>
      ),
    });
  }

  return (
    <div className="space-y-1.5">
      {sections.map(({ label, content }) => (
        <div key={label}>
          <PromptLabel>{label}</PromptLabel>
          <div className="mt-0.5">
            <PromptValue>{content}</PromptValue>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AssetCard({ asset, showGrade, compact, onGrade, onReject, onRegenerate, onEdit, downloadFilename, proxyDownload, onCancelAsset, onUploadAsset }: AssetCardProps) {
  const [grading, setGrading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const badge = TYPE_BADGES[asset.type] || { label: asset.type, color: 'bg-surface-overlay text-text-muted border-border' };
  const isKeyframe = asset.type.startsWith('keyframe');
  const isUploadable = UPLOADABLE_TYPES.has(asset.type) && !!onUploadAsset;

  // Extract the prompt for this specific keyframe (start or end)
  // visual_prompt is a JSONB { start: StructuredPrompt, end: StructuredPrompt }
  const rawPrompt = isKeyframe && asset.scene?.visual_prompt
    ? asset.type === 'keyframe_start'
      ? (asset.scene.visual_prompt as Record<string, unknown>)?.start
      : (asset.scene.visual_prompt as Record<string, unknown>)?.end
    : null;

  // Keep the structured prompt object if available (for rich display in popover)
  const structuredPrompt: StructuredPrompt | null =
    rawPrompt && typeof rawPrompt !== 'string' && isStructuredPrompt(rawPrompt)
      ? rawPrompt
      : null;

  // Legacy flat string fallback
  const keyframePrompt = rawPrompt
    ? typeof rawPrompt === 'string'
      ? rawPrompt
      : isStructuredPrompt(rawPrompt)
        ? serializeForImage(rawPrompt)
        : JSON.stringify(rawPrompt, null, 2)
    : null;

  const hasPrompt = !!(structuredPrompt || keyframePrompt);

  async function handleGrade(grade: string) {
    setGrading(true);
    try {
      onGrade?.(asset.id, grade);
    } finally {
      setGrading(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUploadAsset) return;
    setUploading(true);
    try {
      await onUploadAsset(asset.id, file);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Uploading overlay — show while a user file is being uploaded
  if (uploading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-electric/30 bg-electric/5">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric/50" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-electric">
              Uploading...
            </span>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'generating') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
        {onCancelAsset && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancelAsset(asset.id); }}
            className="absolute top-2 right-2 z-10 rounded-full bg-surface/80 p-1 text-text-muted transition-colors hover:bg-magenta/20 hover:text-magenta"
            title="Cancel generation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? (compact ? 'aspect-[9/16]' : 'aspect-[9/16]') : 'h-24'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Generating...
            </span>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'editing') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-hot/30 bg-amber-hot/5">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-amber-hot" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-amber-hot/50" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-amber-hot">
              Editing...
            </span>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'cancelled') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-surface/50">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-2">
            <svg className="h-6 w-6 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className="text-sm text-text-muted">Cancelled</span>
            <div className="mt-1 flex items-center gap-2">
              {isUploadable && (
                <>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-overlay px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-text-muted transition-all hover:text-electric hover:bg-electric/10"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M8 11V2M4 5l4-3 4 3M2 13h12" />
                    </svg>
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getUploadAccept(asset.type)}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </>
              )}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(asset.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-electric/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-electric transition-all hover:bg-electric/20"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 2v5h5" />
                    <path d="M3.5 10a5 5 0 109-2.3" />
                  </svg>
                  Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'failed') {
    const lastEditError = asset.metadata?.lastEditError as string | undefined;
    const wasEditFailure = !!lastEditError;

    return (
      <div className="relative overflow-hidden rounded-xl border border-magenta/30 bg-magenta/5">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <svg viewBox="0 0 20 20" className="h-6 w-6 text-magenta" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-magenta">
              {wasEditFailure ? 'Edit Failed' : 'Failed'}
            </span>
            {lastEditError && (
              <p className="mt-0.5 max-w-[180px] font-[family-name:var(--font-mono)] text-[9px] leading-tight text-magenta/70">
                {lastEditError.length > 120 ? lastEditError.slice(0, 120) + '...' : lastEditError}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              {isUploadable && (
                <>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-overlay px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-text-muted transition-all hover:text-electric hover:bg-electric/10"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M8 11V2M4 5l4-3 4 3M2 13h12" />
                    </svg>
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getUploadAccept(asset.type)}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </>
              )}
              {wasEditFailure && onEdit && isKeyframe && (
                <button
                  type="button"
                  onClick={() => onEdit(asset.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-hot/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-amber-hot transition-all hover:bg-amber-hot/20"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                  </svg>
                  Retry Edit
                </button>
              )}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(asset.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-magenta/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-magenta transition-all hover:bg-magenta/20"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 2v5h5" />
                    <path d="M3.5 10a5 5 0 109-2.3" />
                  </svg>
                  Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  if (asset.status === 'rejected') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-hot/30 bg-amber-hot/5">
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <div className="flex flex-col items-center gap-2">
            <svg viewBox="0 0 20 20" className="h-6 w-6 text-amber-hot" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-amber-hot">
              Rejected
            </span>
            <div className="mt-1 flex items-center gap-2">
              {isUploadable && (
                <>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-overlay px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-text-muted transition-all hover:text-electric hover:bg-electric/10"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M8 11V2M4 5l4-3 4 3M2 13h12" />
                    </svg>
                    Upload
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getUploadAccept(asset.type)}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </>
              )}
              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(asset.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-hot/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-amber-hot transition-all hover:bg-amber-hot/20"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 2v5h5" />
                    <path d="M3.5 10a5 5 0 109-2.3" />
                  </svg>
                  Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="absolute left-2 top-2">
          <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface group">
      {isKeyframe && asset.url && (
        <img
          src={asset.url}
          alt={`${asset.type} keyframe`}
          className="aspect-[9/16] w-full rounded-t-xl object-cover"
        />
      )}

      {asset.type === 'video' && asset.url && (
        <video
          src={asset.url}
          controls
          className="aspect-[9/16] w-full rounded-t-xl object-cover"
        />
      )}

      {asset.type === 'audio' && (
        <div className="flex h-24 items-center justify-center px-4">
          {asset.url ? (
            <audio src={asset.url} controls className="w-full" />
          ) : (
            <span className="text-xs text-text-muted">No audio URL</span>
          )}
        </div>
      )}

      {!asset.url && asset.status === 'completed' && !['audio'].includes(asset.type) && (
        <div className={`flex items-center justify-center ${isKeyframe || asset.type === 'video' ? 'aspect-[9/16]' : 'h-24'}`}>
          <span className="text-xs text-text-muted">No URL available</span>
        </div>
      )}

      <div className="absolute left-2 top-2 flex items-center gap-1">
        <span className={`inline-flex rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider ${badge.color}`}>
          {badge.label}
        </span>
        {hasPrompt && (
          <button
            type="button"
            onClick={() => setShowPrompt(!showPrompt)}
            title="View generation prompt"
            className="flex h-5 w-5 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-summon/20 hover:text-summon"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 11V7.5" />
              <circle cx="8" cy="5.25" r="0.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}
      </div>

      {/* Prompt popover */}
      {showPrompt && hasPrompt && (
        <div className="absolute inset-x-2 top-9 z-10 max-h-[60%] overflow-y-auto rounded-lg border border-summon/30 bg-void/90 p-3 backdrop-blur-md">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider text-summon">
              Generation Prompt
            </span>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
              className="flex h-4 w-4 items-center justify-center rounded text-text-muted hover:text-text-secondary"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          {structuredPrompt ? (
            <StructuredPromptDisplay prompt={structuredPrompt} />
          ) : (
            <p className="font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-text-secondary">
              {keyframePrompt}
            </p>
          )}
        </div>
      )}

      {Number(asset.cost_usd) > 0 && (
        <div className="absolute right-2 top-2 rounded-md bg-void/70 px-1.5 py-0.5 backdrop-blur-sm">
          <GilDisplay amount={asset.cost_usd} />
        </div>
      )}

      {/* Hidden file input for upload — placed once in the completed card body */}
      {isUploadable && (
        <input
          ref={fileInputRef}
          type="file"
          accept={getUploadAccept(asset.type)}
          onChange={handleFileChange}
          className="hidden"
        />
      )}

      {/* Action buttons: download + upload + edit + reject + regenerate (shown on hover for completed assets) */}
      {asset.status === 'completed' && (onEdit || onReject || onRegenerate || isUploadable || (asset.url && downloadFilename)) && (
        <div className="absolute right-2 bottom-14 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {asset.url && downloadFilename && proxyDownload ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                downloadViaProxy(proxyDownload.projectId, asset.id, downloadFilename);
              }}
              title={`Download ${downloadFilename}`}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-electric/20 hover:text-electric"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
              </svg>
            </button>
          ) : asset.url && downloadFilename ? (
            <DownloadButton url={asset.url} filename={downloadFilename} size="sm" />
          ) : null}
          {isUploadable && (
            <button
              type="button"
              onClick={handleUploadClick}
              title="Upload replacement"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-electric/20 hover:text-electric"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M8 11V2M4 5l4-3 4 3M2 13h12" />
              </svg>
            </button>
          )}
          {onEdit && isKeyframe && (
            <button
              type="button"
              onClick={() => onEdit(asset.id)}
              title="Edit keyframe"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-amber-hot/20 hover:text-amber-hot"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
              </svg>
            </button>
          )}
          {onReject && (
            <button
              type="button"
              onClick={() => onReject(asset.id)}
              title="Reject asset"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-magenta/20 hover:text-magenta"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(asset.id)}
              title="Regenerate asset"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-void/70 text-text-muted backdrop-blur-sm transition-colors hover:bg-electric/20 hover:text-electric"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 2v5h5" />
                <path d="M3.5 10a5 5 0 109-2.3" />
              </svg>
            </button>
          )}
        </div>
      )}

      {showGrade && (
        <div className="border-t border-border p-2">
          <div className="flex gap-1">
            {GRADES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => handleGrade(g.value)}
                disabled={grading}
                className={`flex h-7 w-7 items-center justify-center rounded-md border font-[family-name:var(--font-display)] text-[10px] font-bold transition-all ${
                  asset.grade === g.value
                    ? `${g.color} ring-1 ring-current`
                    : 'border-border bg-surface text-text-muted hover:border-border-bright hover:text-text-secondary'
                }`}
              >
                {g.value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
