'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { uploadAssetToStorage } from './direct-upload';

/* ==============================
   Video Preview Panel (R1.5.29)
   Per-segment expandable panel showing full Kling API payload,
   iterative prompt refinement, and single-segment test generation.
   ============================== */

interface ShotAction {
  time: string;
  action: string;
  energy: 'LOW' | 'PEAK' | 'HIGH';
}

interface PreviewData {
  segmentIndex: number;
  startKeyframe: { url: string; assetId: string } | null;
  endKeyframe: { url: string; assetId: string } | null;
  structuredPrompt: {
    subject?: { primary: string; emphasis: string };
    action?: {
      sequence: ShotAction[];
      energy_arc: string;
    };
    camera_specs?: { shot: string; movement: string };
    environment?: { setting: string; product_visible: boolean };
    lighting?: { type: string; quality: string };
    style?: { aesthetic: string; quality: string };
    negative_prompt?: string;
  };
  serialized: {
    prompt: string;
    multiPrompt?: { prompt: string; duration: string }[];
    negativePrompt: string;
  };
  config: {
    duration: number;
    cfgScale: number;
    aspectRatio: string;
    cost: number;
  };
}

interface TestGenerateResponse {
  assetId: string;
  taskId: string;
  cost: number;
}

interface VideoPreviewPanelProps {
  projectId: string;
  segmentIndex: number;
  onTestApproved?: () => void;
}

export function VideoPreviewPanel({ projectId, segmentIndex, onTestApproved }: VideoPreviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<'preview' | 'test-generate' | null>(null);

  // Feedback / refine state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinementCount, setRefinementCount] = useState(0);

  // Test generation state
  const [isTestGenerating, setIsTestGenerating] = useState(false);
  const [testVideoAsset, setTestVideoAsset] = useState<{ id: string; url: string | null; status: string } | null>(null);
  const [isTestApproved, setIsTestApproved] = useState(false);

  // Collapsible sections
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Video upload state
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoUploadRef = useRef<HTMLInputElement>(null);

  // Elapsed time tracking for generation
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling + timer on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const fetchPreview = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setErrorSource(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/segments/${segmentIndex}/preview`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Preview failed (${res.status})`);
      }
      const data: PreviewData = await res.json();
      setPreviewData(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load preview');
      setErrorSource('preview');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, segmentIndex]);

  function handleToggle() {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !previewData && !isLoading) {
      fetchPreview();
    }
  }

  async function handleRefine() {
    if (!feedback.trim()) return;
    setIsRefining(true);
    setLoadError(null);
    setErrorSource(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/segments/${segmentIndex}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Refine failed (${res.status})`);
      }
      const data: PreviewData = await res.json();
      setPreviewData(data);
      setRefinementCount((c) => c + 1);
      setFeedback('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to refine prompt');
      setErrorSource('preview');
    } finally {
      setIsRefining(false);
    }
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  }

  async function handleTestGenerate() {
    setIsTestGenerating(true);
    setTestVideoAsset(null);
    setLoadError(null);
    setErrorSource(null);
    startTimer();
    try {
      const res = await fetch(`/api/projects/${projectId}/segments/${segmentIndex}/test-generate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Test generate failed (${res.status})`);
      }
      const data: TestGenerateResponse = await res.json();
      setTestVideoAsset({ id: data.assetId, url: null, status: 'generating' });

      // Poll for video completion
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/projects/${projectId}/assets`);
          if (!pollRes.ok) return;
          const pollData = await pollRes.json();
          const allAssets = pollData.assets || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const videoAsset = allAssets.find((a: any) => a.id === data.assetId);
          if (videoAsset) {
            if (videoAsset.status === 'completed' && videoAsset.url) {
              setTestVideoAsset({ id: videoAsset.id, url: videoAsset.url, status: 'completed' });
              setIsTestGenerating(false);
              stopTimer();
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
            } else if (videoAsset.status === 'failed' || videoAsset.status === 'cancelled') {
              setTestVideoAsset({ id: videoAsset.id, url: null, status: videoAsset.status });
              setIsTestGenerating(false);
              stopTimer();
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
            }
          }
        } catch {
          // Ignore poll errors, will retry
        }
      }, 3000);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to start test generation');
      setErrorSource('test-generate');
      setIsTestGenerating(false);
      stopTimer();
    }
  }

  function handleApproveTest() {
    setIsTestApproved(true);
    onTestApproved?.();
  }

  async function handleCancelTestGenerate() {
    if (!testVideoAsset?.id) return;

    // Stop frontend polling and timer
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    stopTimer();

    // Cancel on server
    await fetch(`/api/projects/${projectId}/assets/${testVideoAsset.id}/cancel`, {
      method: 'POST',
    });

    setIsTestGenerating(false);
    setTestVideoAsset(null);
    setElapsedSeconds(0);
  }

  function handleRegenerate() {
    setTestVideoAsset(null);
    setIsTestApproved(false);
    setShowFeedback(true);
  }

  function handleUploadVideoClick() {
    videoUploadRef.current?.click();
  }

  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !testVideoAsset?.id) return;
    setIsUploadingVideo(true);
    setLoadError(null);
    setErrorSource(null);
    try {
      // Upload to Supabase storage
      const { path: storagePath, publicUrl } = await uploadAssetToStorage(file, projectId, testVideoAsset.id);

      // Call upload endpoint to replace the asset
      const res = await fetch(`/api/projects/${projectId}/assets/${testVideoAsset.id}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }

      // Update local state with the new video URL from the API response
      const updated = await res.json();
      setTestVideoAsset({ id: testVideoAsset.id, url: updated.url || publicUrl, status: 'completed' });
      setIsTestApproved(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to upload video');
      setErrorSource('test-generate');
    } finally {
      setIsUploadingVideo(false);
      if (videoUploadRef.current) videoUploadRef.current.value = '';
    }
  }

  const costPerSegment = previewData?.config?.cost ?? 1.20;

  return (
    <div className="mt-3">
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        className="group inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 font-[family-name:var(--font-display)] text-[11px] font-semibold text-text-muted transition-all hover:border-electric/30 hover:text-electric"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 4 10 8 6 12" />
        </svg>
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M6.5 6.5l3 2-3 2v-4z" fill="currentColor" stroke="none" />
        </svg>
        Preview Video Prompt
        {isTestApproved && (
          <span className="ml-1 inline-flex items-center rounded-full bg-lime/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-lime ring-1 ring-lime/30">
            Approved
          </span>
        )}
      </button>

      {/* Expandable panel */}
      {isExpanded && (
        <div className="mt-2 animate-fade-in-up rounded-xl border border-border bg-surface p-5 space-y-5">

          {/* Loading state */}
          {isLoading && !previewData && (
            <div className="flex items-center gap-3 py-6">
              <div className="relative h-6 w-6 flex-shrink-0">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              </div>
              <span className="font-[family-name:var(--font-display)] text-sm text-text-muted">
                Building prompt preview...
              </span>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="rounded-lg border border-magenta/20 bg-magenta/5 px-4 py-3">
              <p className="text-xs text-magenta">{loadError}</p>
              <button
                type="button"
                onClick={errorSource === 'test-generate' ? handleTestGenerate : fetchPreview}
                className="mt-2 rounded-md border border-magenta/30 bg-magenta/10 px-3 py-1 font-[family-name:var(--font-display)] text-xs font-medium text-magenta transition-colors hover:bg-magenta/20"
              >
                {errorSource === 'test-generate' ? 'Retry Generate' : 'Retry Preview'}
              </button>
            </div>
          )}

          {/* Preview content */}
          {previewData && (
            <>
              {/* 1. Keyframe Thumbnails */}
              <div>
                <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Keyframes
                </h4>
                <div className="flex items-center gap-3">
                  {previewData.startKeyframe?.url && (
                    <div className="relative">
                      <span className="absolute -top-1.5 left-1.5 rounded-sm bg-surface-overlay px-1 py-0.5 font-[family-name:var(--font-mono)] text-[8px] font-bold uppercase tracking-wider text-text-muted">
                        Start
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewData.startKeyframe.url}
                        alt="Start keyframe"
                        className="h-[120px] w-auto rounded-lg border border-border object-cover"
                      />
                    </div>
                  )}
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-shrink-0 text-text-muted" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <path d="M5 12h14m-4-4l4 4-4 4" />
                  </svg>
                  {previewData.endKeyframe?.url && (
                    <div className="relative">
                      <span className="absolute -top-1.5 left-1.5 rounded-sm bg-surface-overlay px-1 py-0.5 font-[family-name:var(--font-mono)] text-[8px] font-bold uppercase tracking-wider text-text-muted">
                        End
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewData.endKeyframe.url}
                        alt="End keyframe"
                        className="h-[120px] w-auto rounded-lg border border-border object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Main Prompt */}
              <div>
                <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Main Prompt
                </h4>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-electric/10 bg-void px-4 py-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-electric">
                  {previewData.serialized.prompt}
                </pre>
              </div>

              {/* 3. Shot Timeline */}
              {previewData.structuredPrompt.action?.sequence && previewData.structuredPrompt.action.sequence.length > 0 && (
                <div>
                  <h4 className="mb-2 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Shot Timeline
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {previewData.structuredPrompt.action.sequence.map((shot, i) => (
                      <ShotCard key={i} shot={shot} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Negative Prompt (collapsible) */}
              {previewData.serialized.negativePrompt && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowNegativePrompt(!showNegativePrompt)}
                    className="inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      className={`h-2.5 w-2.5 transition-transform duration-200 ${showNegativePrompt ? 'rotate-90' : ''}`}
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 4 10 8 6 12" />
                    </svg>
                    {showNegativePrompt ? 'Hide' : 'Show'} Negative Prompt
                  </button>
                  {showNegativePrompt && (
                    <p className="mt-2 text-xs leading-relaxed text-text-muted break-words">
                      {previewData.serialized.negativePrompt}
                    </p>
                  )}
                </div>
              )}

              {/* 4b. Raw JSON (collapsible) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`h-2.5 w-2.5 transition-transform duration-200 ${showRawJson ? 'rotate-90' : ''}`}
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 4 10 8 6 12" />
                  </svg>
                  {showRawJson ? 'Hide' : 'Show'} Raw JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-border bg-void p-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-text-secondary">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(previewData.serialized.prompt), null, 2); }
                      catch { return previewData.serialized.prompt; }
                    })()}
                  </pre>
                )}
              </div>

              {/* 5. Config Bar */}
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface-raised px-4 py-2.5">
                <ConfigValue label="Duration" value={`${previewData.config.duration}s`} />
                <ConfigValue label="CFG Scale" value={String(previewData.config.cfgScale)} />
                <ConfigValue label="Aspect Ratio" value={previewData.config.aspectRatio} />
                <ConfigValue label="Cost" value={`$${previewData.config.cost.toFixed(2)}`} valueClass="text-amber-hot" />
              </div>

              {/* Hidden file input for video upload */}
              <input
                ref={videoUploadRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleVideoFileChange}
                className="hidden"
              />

              {/* 6. Action Buttons */}
              {!isTestApproved && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFeedback(!showFeedback)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-electric/30 bg-electric/5 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-electric transition-all hover:bg-electric/10"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                    </svg>
                    Adjust Prompt
                  </button>
                  {isTestGenerating ? (
                    <button
                      type="button"
                      onClick={handleCancelTestGenerate}
                      className="inline-flex items-center gap-2 rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-magenta transition-all hover:bg-magenta/20"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Generation
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTestGenerate}
                      className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(0,229,160,0.25)]"
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="12" height="10" rx="1.5" />
                        <path d="M6.5 6.5l3 2-3 2v-4z" fill="currentColor" stroke="none" />
                      </svg>
                      Test Generate (${costPerSegment.toFixed(2)})
                    </button>
                  )}
                  {/* Upload Video — only shown when there's an existing video asset to replace */}
                  {testVideoAsset && ['completed', 'failed', 'cancelled'].includes(testVideoAsset.status) && !isTestGenerating && (
                    <button
                      type="button"
                      onClick={handleUploadVideoClick}
                      disabled={isUploadingVideo}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-text-muted transition-all hover:border-electric/30 hover:text-electric disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUploadingVideo ? (
                        <>
                          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                          </svg>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <path d="M8 11V2M4 5l4-3 4 3M2 13h12" />
                          </svg>
                          Upload Video
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* 7. Feedback Area */}
              {showFeedback && !isTestApproved && (
                <div className="rounded-lg border border-electric/10 bg-void p-4 space-y-3">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Describe what to change (e.g., 'Make shot 2 more energetic, add a smile')"
                    rows={3}
                    className="block w-full resize-none rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={isRefining || !feedback.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_16px_rgba(0,229,160,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRefining ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                          </svg>
                          Refining...
                        </>
                      ) : (
                        'Refine Prompt'
                      )}
                    </button>
                    {refinementCount > 0 && (
                      <span className="font-[family-name:var(--font-mono)] text-[11px] text-text-muted">
                        Refinement {refinementCount} of &infin;
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 8. Test Video Result */}
              {testVideoAsset && (
                <div className="rounded-lg border border-border bg-surface-raised p-4 space-y-3">
                  <h4 className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Test Video
                  </h4>

                  {/* Generating progress */}
                  {testVideoAsset.status === 'generating' && (
                    <GeneratingProgress elapsedSeconds={elapsedSeconds} />
                  )}

                  {/* Failed */}
                  {testVideoAsset.status === 'failed' && (
                    <div className="rounded-lg border border-magenta/20 bg-magenta/5 px-4 py-3">
                      <p className="text-xs text-magenta">Test video generation failed. Try adjusting the prompt and regenerating.</p>
                    </div>
                  )}

                  {/* Cancelled */}
                  {testVideoAsset.status === 'cancelled' && (
                    <div className="rounded-lg border border-border/50 bg-surface/50 px-4 py-3">
                      <p className="text-xs text-text-muted">Test video generation was cancelled.</p>
                    </div>
                  )}

                  {/* Completed — video player */}
                  {testVideoAsset.status === 'completed' && testVideoAsset.url && (
                    <div className="space-y-3">
                      <div className="mx-auto w-[200px]">
                        <video
                          src={testVideoAsset.url}
                          controls
                          className="w-full rounded-lg border border-border aspect-[9/16] bg-void"
                        >
                          <track kind="captions" />
                        </video>
                      </div>

                      {!isTestApproved && (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={handleApproveTest}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-lime px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(122,255,110,0.25)]"
                          >
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3.5 8 6.5 11 12.5 5" />
                            </svg>
                            Approve Test
                          </button>
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-hot/30 bg-amber-hot/10 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-amber-hot transition-all hover:bg-amber-hot/20"
                          >
                            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1.5 8a6.5 6.5 0 0111.48-4.16" />
                              <path d="M14.5 8a6.5 6.5 0 01-11.48 4.16" />
                              <polyline points="13 1.5 13 4.5 10 4.5" />
                              <polyline points="3 14.5 3 11.5 6 11.5" />
                            </svg>
                            Regenerate
                          </button>
                        </div>
                      )}

                      {isTestApproved && (
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-lime/20 bg-lime/5 px-4 py-2">
                          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-lime" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3.5 8 6.5 11 12.5 5" />
                          </svg>
                          <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-lime">
                            Test Approved — segment will be skipped during full generation
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ==============================
   Sub-components
   ============================== */

function ShotCard({ shot, index }: { shot: ShotAction; index: number }) {
  const energyColors: Record<string, string> = {
    LOW: 'bg-surface-overlay text-text-muted border-border',
    HIGH: 'bg-electric/10 text-electric border-electric/20',
    PEAK: 'bg-lime/10 text-lime border-lime/20',
  };

  const energyStyle = energyColors[shot.energy] || energyColors.LOW;

  return (
    <div className="rounded-lg border border-border bg-void p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="rounded-md bg-surface-overlay px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-secondary">
          {shot.time}
        </span>
        <span className={`rounded-md border px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-wider ${energyStyle}`}>
          {shot.energy}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">
        {shot.action}
      </p>
      <span className="font-[family-name:var(--font-mono)] text-[9px] text-text-muted">
        Shot {index + 1}
      </span>
    </div>
  );
}

function ConfigValue({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-[family-name:var(--font-display)] text-[9px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className={`font-[family-name:var(--font-mono)] text-xs font-bold ${valueClass || 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

// Typical Kling 3.0 Pro generation: 2-5 minutes. Use 180s as the "expected" midpoint.
const EXPECTED_DURATION_S = 180;

function GeneratingProgress({ elapsedSeconds }: { elapsedSeconds: number }) {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const elapsed = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Asymptotic progress: approaches 95% around EXPECTED_DURATION_S, never reaches 100%
  const progress = Math.min(95, (elapsedSeconds / (elapsedSeconds + EXPECTED_DURATION_S / 2)) * 100);

  // Phase labels based on elapsed time
  let phase = 'Submitting to Kling 3.0 Pro...';
  if (elapsedSeconds > 10) phase = 'Rendering video frames...';
  if (elapsedSeconds > 90) phase = 'Finalizing video...';
  if (elapsedSeconds > 180) phase = 'Still processing — almost there...';
  if (elapsedSeconds > 300) phase = 'Taking longer than usual...';

  return (
    <div className="space-y-3 py-3">
      {/* Header row: spinner + elapsed */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative h-5 w-5 flex-shrink-0">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div className="absolute inset-0.5 animate-spin rounded-full border-2 border-transparent border-b-electric-dim" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <span className="font-[family-name:var(--font-display)] text-sm font-medium text-electric">
            Generating test video
          </span>
        </div>
        <span className="font-[family-name:var(--font-mono)] text-sm font-bold tabular-nums text-text-primary">
          {elapsed}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-overlay">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-electric/80 to-electric transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
        {/* Shimmer effect */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Phase label */}
      <p className="text-xs text-text-muted">
        {phase}
      </p>
    </div>
  );
}
