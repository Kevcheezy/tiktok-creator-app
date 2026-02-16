'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from './confirm-dialog';
import { uploadToStorage } from './direct-upload';

interface Influencer {
  id: string;
  name: string;
  persona: string | null;
  image_url: string | null;
  cost_usd: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  voice_id: string | null;
  voice_preset_id: string | null;
  voice_description: string | null;
  voice_preview_url: string | null;
}

interface VoicePreset {
  id: string;
  name: string;
  description: string;
  gender: string;
  sample_text: string | null;
  category_affinity: string[];
  is_system: boolean;
}

interface VoicePreviewData {
  previewUrl: string;
  temporaryVoiceId: string;
  description: string;
}

function formatDate(date: string | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Voice Section sub-component ---

function VoiceSection({ influencer, influencerId, onInfluencerUpdate }: {
  influencer: Influencer;
  influencerId: string;
  onInfluencerUpdate: (updated: Influencer) => void;
}) {
  // Voice state machine: 'select' | 'preview' | 'approved'
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customDescription, setCustomDescription] = useState('');
  const [customGender, setCustomGender] = useState<'female' | 'male'>('female');
  const [designing, setDesigning] = useState(false);
  const [designError, setDesignError] = useState('');
  const [voicePreview, setVoicePreview] = useState<VoicePreviewData | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [changingVoice, setChangingVoice] = useState(false);
  const [changeVoiceError, setChangeVoiceError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // Determine current state
  const hasVoice = !!influencer.voice_id;
  const hasPreview = !!voicePreview;

  // Fetch voice presets
  useEffect(() => {
    fetch('/api/voice-presets')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setVoicePresets(Array.isArray(data) ? data : (data.presets || []));
      })
      .catch(() => setVoicePresets([]))
      .finally(() => setPresetsLoading(false));
  }, []);

  const handleDesignVoice = useCallback(async () => {
    setDesigning(true);
    setDesignError('');
    try {
      const body: Record<string, string> = {};
      if (customMode && customDescription.trim()) {
        body.customDescription = customDescription.trim();
        body.gender = customGender;
      } else if (selectedPresetId) {
        body.presetId = selectedPresetId;
      } else {
        setDesignError('Select a preset or write a custom description');
        setDesigning(false);
        return;
      }

      const res = await fetch(`/api/influencers/${influencerId}/voice/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to design voice');
      }

      const data = await res.json();
      setVoicePreview({
        previewUrl: data.previewUrl,
        temporaryVoiceId: data.temporaryVoiceId,
        description: data.description || customDescription || '',
      });
    } catch (err) {
      setDesignError(err instanceof Error ? err.message : 'Failed to design voice');
    } finally {
      setDesigning(false);
    }
  }, [influencerId, selectedPresetId, customMode, customDescription, customGender]);

  const handleApproveVoice = useCallback(async () => {
    if (!voicePreview) return;
    setApproving(true);
    setApproveError('');
    try {
      const res = await fetch(`/api/influencers/${influencerId}/voice/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temporaryVoiceId: voicePreview.temporaryVoiceId,
          presetId: customMode ? undefined : selectedPresetId,
          description: voicePreview.description,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to approve voice');
      }

      const data = await res.json();
      // Update the influencer record with voice data
      onInfluencerUpdate({
        ...influencer,
        voice_id: data.voiceId,
        voice_preview_url: data.previewUrl,
        voice_preset_id: customMode ? null : selectedPresetId,
        voice_description: voicePreview.description,
      } as Influencer);
      setVoicePreview(null);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Failed to approve voice');
    } finally {
      setApproving(false);
    }
  }, [influencerId, voicePreview, influencer, onInfluencerUpdate, customMode, selectedPresetId]);

  const handleTryAgain = useCallback(() => {
    setVoicePreview(null);
    setApproveError('');
  }, []);

  const handleChangeVoice = useCallback(async () => {
    setChangingVoice(true);
    setChangeVoiceError('');
    try {
      const res = await fetch(`/api/influencers/${influencerId}/voice`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove voice from server');
      }
      // Server cleared successfully — now reset local state
      setSelectedPresetId(null);
      setCustomMode(false);
      setCustomDescription('');
      setVoicePreview(null);
      onInfluencerUpdate({
        ...influencer,
        voice_id: null,
        voice_preset_id: null,
        voice_description: null,
        voice_preview_url: null,
      } as Influencer);
    } catch (err) {
      setChangeVoiceError(err instanceof Error ? err.message : 'Failed to change voice');
    } finally {
      setChangingVoice(false);
    }
  }, [influencerId, influencer, onInfluencerUpdate]);

  const handleRemoveVoice = useCallback(async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/influencers/${influencerId}/voice`, {
        method: 'DELETE',
      });
      if (res.ok) {
        onInfluencerUpdate({
          ...influencer,
          voice_id: null,
          voice_preset_id: null,
          voice_description: null,
          voice_preview_url: null,
        } as Influencer);
        setShowRemoveConfirm(false);
        setSelectedPresetId(null);
        setCustomMode(false);
        setCustomDescription('');
      }
    } catch {
      // silent fail
    } finally {
      setRemoving(false);
    }
  }, [influencerId, influencer, onInfluencerUpdate]);

  const handlePresetSelect = useCallback((presetId: string) => {
    setCustomMode(false);
    setCustomDescription('');
    setSelectedPresetId(selectedPresetId === presetId ? null : presetId);
    setDesignError('');
  }, [selectedPresetId]);

  const handleCustomSelect = useCallback(() => {
    setSelectedPresetId(null);
    setCustomMode(true);
    setDesignError('');
  }, []);

  // Find preset name for display
  const voicePresetName = influencer.voice_preset_id
    ? voicePresets.find((p) => p.id === influencer.voice_preset_id)?.name || 'Preset'
    : 'Custom';

  const selectedPresetName = selectedPresetId
    ? voicePresets.find((p) => p.id === selectedPresetId)?.name || 'Preset'
    : customMode ? 'Custom' : '';

  const canDesign = (selectedPresetId && !customMode) || (customMode && customDescription.trim().length > 0);

  // --- State C: Voice Approved ---
  if (hasVoice) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
              Voice
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-lime">
              <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v12M5 5l-2 3 2 3M11 5l2 3-2 3" />
              </svg>
              Voice Designed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleChangeVoice}
              disabled={changingVoice}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-50"
            >
              {changingVoice && (
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
              )}
              {changingVoice ? 'Changing...' : 'Change Voice'}
            </button>
            <button
              type="button"
              onClick={() => setShowRemoveConfirm(true)}
              className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-muted transition-colors hover:border-magenta/40 hover:bg-magenta/5 hover:text-magenta"
            >
              Remove Voice
            </button>
          </div>
        </div>

        {/* Voice info */}
        <div className="rounded-lg border border-border-bright bg-surface-raised p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-lime/10">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-lime" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M5 6l-2 6 2 6M19 6l2 6-2 6" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-display)] text-sm font-semibold text-text-primary">
                {voicePresetName}
              </p>
              {influencer.voice_description && (
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {influencer.voice_description}
                </p>
              )}
            </div>
          </div>

          {/* Audio player */}
          {influencer.voice_preview_url && (
            <div className="mt-4 rounded-lg border border-border bg-surface p-3">
              <audio
                ref={audioRef}
                src={influencer.voice_preview_url}
                controls
                className="w-full h-8 [&::-webkit-media-controls-panel]:bg-surface-raised [&::-webkit-media-controls-panel]:rounded-lg"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          )}
        </div>

        {/* Change voice error */}
        {changeVoiceError && (
          <p className="mt-3 font-[family-name:var(--font-display)] text-xs font-medium text-magenta">
            {changeVoiceError}
          </p>
        )}

        <ConfirmDialog
          open={showRemoveConfirm}
          title="Remove Voice"
          description={`Remove the designed voice from "${influencer.name}"? They will need a new voice before being selected for any project.`}
          confirmLabel="Remove Voice"
          onConfirm={handleRemoveVoice}
          onCancel={() => setShowRemoveConfirm(false)}
          loading={removing}
        />
      </div>
    );
  }

  // --- State B: Voice Preview ---
  if (hasPreview && voicePreview) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Voice Preview
        </h2>

        <div className="rounded-lg border border-lime/20 bg-lime/5 p-4">
          {/* Preset/description info */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime/15">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-lime" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v12M5 5l-2 3 2 3M11 5l2 3-2 3" />
              </svg>
            </div>
            <div>
              <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                {selectedPresetName || 'Voice Preview'}
              </p>
              {voicePreview.description && (
                <p className="mt-0.5 text-[11px] text-text-muted line-clamp-1">{voicePreview.description}</p>
              )}
            </div>
          </div>

          {/* Audio player */}
          <div className="mt-3 rounded-lg border border-border bg-surface p-3">
            <audio
              src={voicePreview.previewUrl}
              controls
              autoPlay
              className="w-full h-8 [&::-webkit-media-controls-panel]:bg-surface-raised [&::-webkit-media-controls-panel]:rounded-lg"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* Error */}
          {approveError && (
            <p className="mt-2 font-[family-name:var(--font-display)] text-xs font-medium text-magenta">
              {approveError}
            </p>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleApproveVoice}
              disabled={approving}
              className="inline-flex items-center gap-2 rounded-lg bg-lime px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(122,255,110,0.25)] disabled:opacity-50"
            >
              {approving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                  </svg>
                  Approving...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3.5 8 6.5 11 12.5 5" />
                  </svg>
                  Approve Voice
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleTryAgain}
              disabled={approving}
              className="rounded-lg border border-border px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-50"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- State A: No Voice (preset selection) ---
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Voice
        </h2>
        <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
          Not designed
        </span>
      </div>

      {presetsLoading ? (
        <div className="flex items-center gap-3 py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-electric border-t-transparent" />
          <span className="text-sm text-text-secondary">Loading voice presets...</span>
        </div>
      ) : (
        <>
          {/* Voice preset card grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {voicePresets.map((preset) => {
              const isSelected = selectedPresetId === preset.id && !customMode;
              const isMale = preset.gender === 'male';

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`group relative rounded-lg border-2 p-3 text-left transition-all ${
                    isSelected
                      ? 'border-electric bg-electric/5 ring-1 ring-electric/30'
                      : 'border-border bg-surface-raised hover:border-border-bright hover:bg-surface-overlay'
                  }`}
                >
                  {/* Category affinity badges */}
                  {preset.category_affinity && preset.category_affinity.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {preset.category_affinity.slice(0, 2).map((cat) => (
                        <span
                          key={cat}
                          className="rounded-full bg-surface-overlay px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] text-text-muted"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title + gender icon */}
                  <div className="flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" fill="none" className={`h-3 w-3 flex-shrink-0 ${isMale ? 'text-electric' : 'text-magenta'}`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      {isMale ? (
                        <>
                          <circle cx="6.5" cy="9.5" r="4" />
                          <path d="M10 6l4-4M14 2v3.5M10.5 5.5H14" />
                        </>
                      ) : (
                        <>
                          <circle cx="8" cy="6" r="4" />
                          <path d="M8 10v4M6 12.5h4" />
                        </>
                      )}
                    </svg>
                    <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                      {preset.name}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="mt-1 text-[11px] leading-relaxed text-text-muted line-clamp-2">
                    {preset.description}
                  </p>

                  {/* Selection checkmark */}
                  {isSelected && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-electric">
                      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-void" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3.5 8 6.5 11 12.5 5" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}

            {/* + Custom card */}
            <button
              type="button"
              onClick={handleCustomSelect}
              className={`rounded-lg border-2 border-dashed p-3 text-left transition-all ${
                customMode
                  ? 'border-electric bg-electric/5'
                  : 'border-border-bright bg-surface-raised hover:border-electric/50 hover:bg-surface-overlay'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-text-muted" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="8" y1="3" x2="8" y2="13" />
                  <line x1="3" y1="8" x2="13" y2="8" />
                </svg>
                <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-secondary">
                  Custom
                </p>
              </div>
              <p className="mt-1 text-[11px] text-text-muted">
                Describe the voice yourself
              </p>
            </button>
          </div>

          {/* Custom mode: description + gender selector */}
          {customMode && (
            <div className="mt-3 space-y-3">
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                rows={3}
                placeholder="Describe the voice: tone, pitch, energy, personality..."
                className="block w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric resize-none"
              />
              <div className="flex items-center gap-3">
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Gender
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomGender('female')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                      customGender === 'female'
                        ? 'bg-magenta/15 text-magenta border border-magenta/30'
                        : 'bg-surface-raised text-text-muted border border-border hover:border-border-bright'
                    }`}
                  >
                    Female
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomGender('male')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                      customGender === 'male'
                        ? 'bg-electric/15 text-electric border border-electric/30'
                        : 'bg-surface-raised text-text-muted border border-border hover:border-border-bright'
                    }`}
                  >
                    Male
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Design error */}
          {designError && (
            <p className="mt-2 font-[family-name:var(--font-display)] text-xs font-medium text-magenta">
              {designError}
            </p>
          )}

          {/* Design Voice button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDesignVoice}
              disabled={!canDesign || designing}
              className="inline-flex items-center gap-2 rounded-lg bg-electric px-5 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,229,160,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {designing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                  </svg>
                  Designing voice...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v12M5 5l-2 3 2 3M11 5l2 3-2 3" />
                  </svg>
                  Design Voice
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}


// --- Main component ---

export function InfluencerDetail({ influencerId }: { influencerId: string }) {
  const router = useRouter();
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ message: string; projects: { id: string; name: string | null; status: string }[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPersona, setEditPersona] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/influencers/${influencerId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/influencers');
      } else if (res.status === 409) {
        const data = await res.json();
        setDeleteError({ message: data.error, projects: data.projects || [] });
        setDeleting(false);
        setShowDeleteConfirm(false);
      } else {
        setDeleteError({ message: 'Failed to delete influencer', projects: [] });
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      setDeleteError({ message: 'Failed to delete influencer', projects: [] });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [influencerId, router]);

  const enterEditMode = useCallback(() => {
    if (!influencer) return;
    setEditName(influencer.name);
    setEditPersona(influencer.persona || '');
    setEditMode(true);
  }, [influencer]);

  const cancelEditMode = useCallback(() => {
    setEditMode(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!influencer) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/influencers/${influencerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), persona: editPersona.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInfluencer(updated);
        setEditMode(false);
      }
    } catch {
      // stay in edit mode on failure
    } finally {
      setSaving(false);
    }
  }, [influencer, influencerId, editName, editPersona]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleImageUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('idle');
    try {
      // Upload directly to storage
      const { path } = await uploadToStorage(file, 'influencer', influencerId);

      // Update influencer record with storage path
      const res = await fetch(`/api/influencers/${influencerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path }),
      });
      if (res.ok) {
        const updated = await res.json();
        setInfluencer(updated);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setUploadStatus('success');
      } else {
        setUploadStatus('error');
      }
    } catch {
      setUploadStatus('error');
    } finally {
      setUploading(false);
    }
  }, [influencerId]);

  const handleCancelPreview = useCallback(() => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    fetch(`/api/influencers/${influencerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => {
        setInfluencer(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [influencerId]);

  useEffect(() => {
    if (uploadStatus === 'idle') return;
    const timer = setTimeout(() => setUploadStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [uploadStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div
              className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta"
              style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
            />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">
            Loading influencer...
          </p>
        </div>
      </div>
    );
  }

  if (error || !influencer) {
    return (
      <div className="animate-fade-in-up">
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-8 w-8 text-text-muted"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="mt-4 text-text-secondary">Influencer not found.</p>
          <Link
            href="/influencers"
            className="mt-4 inline-flex text-sm text-electric hover:underline"
          >
            Back to Influencers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Back link */}
      <Link
        href="/influencers"
        className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-sm text-text-secondary transition-colors hover:text-electric"
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
        Influencers
      </Link>

      {/* Delete error banner */}
      {deleteError && (
        <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-4">
          <p className="font-[family-name:var(--font-display)] text-sm font-medium text-magenta">
            {deleteError.message}
          </p>
          {deleteError.projects.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {deleteError.projects.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-[family-name:var(--font-display)] text-sm text-electric hover:underline"
                  >
                    {p.name || 'Untitled project'}
                  </Link>
                  <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="mt-3 font-[family-name:var(--font-display)] text-xs text-text-muted hover:text-text-secondary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editMode ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') cancelEditMode();
              }}
              className="w-full rounded-lg border border-electric/30 bg-surface-raised px-3 py-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary outline-none focus:border-electric/60 focus:ring-1 focus:ring-electric/30"
              autoFocus
            />
          ) : (
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-text-primary">
              {influencer.name}
            </h1>
          )}
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-md bg-surface-overlay px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary">
              {influencer.status}
            </span>
            {influencer.created_at && (
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                Created {formatDate(influencer.created_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {editMode ? (
            <>
              <button
                type="button"
                onClick={cancelEditMode}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-2 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="rounded-lg border border-electric/30 bg-electric/10 px-3 py-2 font-[family-name:var(--font-display)] text-xs font-medium text-electric transition-colors hover:bg-electric/20 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={enterEditMode}
                className="rounded-lg border border-border p-2.5 text-text-muted transition-all hover:border-electric/40 hover:bg-electric/5 hover:text-electric"
                title="Edit influencer"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" />
                  <path d="M9.5 3.5l3 3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg border border-border p-2.5 text-text-muted transition-all hover:border-magenta/40 hover:bg-magenta/5 hover:text-magenta"
                title="Delete influencer"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12" />
                  <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
                  <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
                  <line x1="6.5" y1="7" x2="6.5" y2="11" />
                  <line x1="9.5" y1="7" x2="9.5" y2="11" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Base Image */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Reference Image
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {previewUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  disabled={uploading}
                  className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-border-bright hover:text-text-primary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={uploading}
                  className="rounded-lg border border-electric/30 bg-electric/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-electric transition-colors hover:bg-electric/20 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Confirm Upload'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-secondary transition-colors hover:border-electric/40 hover:bg-electric/5 hover:text-electric"
              >
                {influencer.image_url ? 'Replace Image' : 'Upload Image'}
              </button>
            )}
          </div>
        </div>

        {/* Upload status feedback */}
        {uploadStatus === 'success' && (
          <p className="mb-2 font-[family-name:var(--font-display)] text-xs font-medium text-lime">
            Image updated successfully
          </p>
        )}
        {uploadStatus === 'error' && (
          <p className="mb-2 font-[family-name:var(--font-display)] text-xs font-medium text-magenta">
            Failed to upload image
          </p>
        )}

        {/* Preview of new image (before confirming) */}
        {previewUrl && (
          <div className="mb-4 rounded-lg border-2 border-dashed border-electric/40 bg-electric/5 p-3">
            <p className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-electric">
              New Image Preview
            </p>
            <img
              src={previewUrl}
              alt="New reference preview"
              className="max-h-64 rounded-lg object-contain"
            />
          </div>
        )}

        {/* Current image */}
        {influencer.image_url ? (
          <div className="relative overflow-hidden rounded-lg border border-border-bright bg-surface-raised">
            <img
              src={influencer.image_url}
              alt={`${influencer.name} reference`}
              className="w-full max-w-lg object-contain"
            />
            <div className="absolute right-0 top-0 h-16 w-16">
              <div className="absolute right-0 top-0 h-px w-8 bg-gradient-to-l from-magenta/50 to-transparent" />
              <div className="absolute right-0 top-0 h-8 w-px bg-gradient-to-b from-magenta/50 to-transparent" />
            </div>
            {/* 4K badge — cost_usd > 0 means image was auto-upscaled */}
            {influencer.cost_usd && parseFloat(influencer.cost_usd) > 0 && (
              <span className="absolute left-3 top-3 rounded border border-electric/30 bg-electric/90 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-bold leading-none text-void shadow-sm shadow-electric/20">4K</span>
            )}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-bright bg-surface-raised">
            <div className="text-center">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                className="mx-auto h-10 w-10 text-text-muted"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="24" height="24" rx="3" />
                <circle cx="11" cy="13" r="3" />
                <path d="M28 22l-6-6-14 14" />
              </svg>
              <p className="mt-3 text-sm text-text-muted">No reference image uploaded</p>
            </div>
          </div>
        )}
      </div>

      {/* Voice Section */}
      <VoiceSection
        influencer={influencer}
        influencerId={influencerId}
        onInfluencerUpdate={setInfluencer}
      />

      {/* Persona */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Persona
        </h2>
        {editMode ? (
          <textarea
            value={editPersona}
            onChange={(e) => setEditPersona(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelEditMode();
            }}
            rows={5}
            placeholder="Describe this influencer's persona, style, and personality..."
            className="w-full resize-y rounded-lg border border-electric/30 bg-surface-raised px-3 py-2 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted/50 focus:border-electric/60 focus:ring-1 focus:ring-electric/30"
          />
        ) : influencer.persona ? (
          <p className="text-sm leading-relaxed text-text-secondary">
            {influencer.persona}
          </p>
        ) : (
          <p className="text-sm italic text-text-muted">No persona description provided</p>
        )}
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
          Details
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              ID
            </dt>
            <dd className="mt-1 font-[family-name:var(--font-mono)] text-xs text-text-secondary">
              {influencer.id}
            </dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Status
            </dt>
            <dd className="mt-1 text-sm text-text-primary">{influencer.status}</dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Has Image
            </dt>
            <dd className="mt-1 text-sm text-text-primary">
              {influencer.image_url ? (
                influencer.cost_usd && parseFloat(influencer.cost_usd) > 0 ? (
                  <span className="text-electric">Yes (4K)</span>
                ) : (
                  <span className="text-lime">Yes</span>
                )
              ) : (
                <span className="text-text-muted">No</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Has Voice
            </dt>
            <dd className="mt-1 text-sm text-text-primary">
              {influencer.voice_id ? (
                <span className="text-lime">Yes</span>
              ) : (
                <span className="text-text-muted">No</span>
              )}
            </dd>
          </div>
          {influencer.created_at && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Created
              </dt>
              <dd className="mt-1 text-sm text-text-secondary">
                {formatDate(influencer.created_at)}
              </dd>
            </div>
          )}
          {influencer.updated_at && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Updated
              </dt>
              <dd className="mt-1 text-sm text-text-secondary">
                {formatDate(influencer.updated_at)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Influencer"
        description={`Are you sure you want to delete "${influencer.name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />
    </div>
  );
}
