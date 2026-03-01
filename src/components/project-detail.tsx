'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from './status-badge';
import { PipelineProgress } from './pipeline-progress';
import { ScriptReview } from './script-review';
import { ConceptReview } from './concept-review';
import { AssetReview } from './asset-review';
import { StoryboardView } from './storyboard-view';
import { ConfirmDialog } from './confirm-dialog';
import { StageProgress } from './stage-progress';
import { ToneSelector } from './tone-selector';
import { SCRIPT_TONES } from '@/lib/constants';
import { BattleHUD } from './battle-hud';
import { uploadToStorage } from './direct-upload';
import { CommandMenu } from './command-menu';
import { GilDisplay } from './gil-display';
import { PresetSelector, type Preset } from './preset-selector';
import { NegativePromptPanel } from './negative-prompt-panel';
import { downloadAsset, finalVideoFilename } from '@/lib/download-utils';

interface ProjectData {
  id: string;
  project_number: number | null;
  name: string | null;
  status: string;
  product_url: string;
  product_name: string | null;
  product_category: string | null;
  product_image_url: string | null;
  product_data: {
    product_name?: string;
    brand?: string;
    product_type?: string;
    product_size?: string;
    product_price?: string;
    category?: string;
    selling_points?: string[];
    key_claims?: string[];
    usage?: string;
    benefits?: string[];
    hook_angle?: string;
    product_image_url?: string;
    image_description_for_nano_banana_pro?: string;
    avatar_description?: string;
  } | null;
  tone: string | null;
  character_id: string | null;
  cost_usd: string | null;
  error_message: string | null;
  failed_at_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  character: { id: string; name: string; avatar_persona: string | null } | null;
  video_analysis: Record<string, unknown> | null;
  influencer_id: string | null;
  influencer: { id: string; name: string; persona: string | null; image_url: string | null } | null;
  product_id: string | null;
  product: { id: string; name: string | null; image_url: string | null } | null;
  video_model_id: string | null;
  video_model: { id: string; name: string; slug: string; resolution: string; total_duration: number; segment_count: number; provider: string; cost_per_segment: number } | null;
  negative_prompt_override: unknown;
  fast_mode: boolean | null;
  lock_camera: boolean | null;
  keyframe_chaining: boolean | null;
  video_retries: number;
  scene_preset_id: string | null;
  scene_override: string | null;
  interaction_preset_id: string | null;
  interaction_override: string | null;
  concept: {
    persona: { demographics: string; psychographics: string; current_situation: string; desired_outcomes: string };
    pain_points: { functional: string[]; emotional: string[] };
    unique_mechanism: string;
    transformation: { before: string; after: string };
    hook_angle: string;
  } | null;
}

// Client-side rollback map (mirrors backend cancel endpoint)
const CANCEL_ROLLBACK: Record<string, string> = {
  analyzing: 'created',
  scripting: 'analysis_review',
  broll_planning: 'script_review',
  broll_generation: 'casting_review',
  casting: 'influencer_selection',
  directing: 'casting_review',
  voiceover: 'casting_review',
  editing: 'asset_review',
};

const NAV_STAGE_LABELS: Record<string, string> = {
  analysis_review: 'Analysis Review',
  concept_review: 'Concept Review',
  script_review: 'Script Review',
  broll_review: 'B-Roll Review',
  influencer_selection: 'Influencer Selection',
  casting_review: 'Casting Review',
  asset_review: 'Asset Review',
};

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  const [archived, setArchived] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelToast, setCancelToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const failCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scene/interaction preset state for casting_review editing
  const [castingScenePresets, setCastingScenePresets] = useState<Preset[]>([]);
  const [castingInteractionPresets, setCastingInteractionPresets] = useState<Preset[]>([]);
  const [castingSceneId, setCastingSceneId] = useState<string | null>(null);
  const [castingSceneOverride, setCastingSceneOverride] = useState('');
  const [castingInteractionId, setCastingInteractionId] = useState<string | null>(null);
  const [castingInteractionOverride, setCastingInteractionOverride] = useState('');

  // Navigation state for viewing past stages
  const [viewingStage, setViewingStage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [impactData, setImpactData] = useState<{
    warning: string;
    estimatedCost: number;
    restartFrom: string | null;
    allAffectedStages: string[];
  } | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        failCountRef.current = 0;
        setConnectionWarning(false);
      } else {
        failCountRef.current++;
        if (failCountRef.current >= 5) setConnectionWarning(true);
      }
    } catch (err) {
      console.error('Failed to fetch project:', err);
      failCountRef.current++;
      if (failCountRef.current >= 5) setConnectionWarning(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll while in processing state with exponential backoff on failure
  useEffect(() => {
    if (!project) return;
    const processingStatuses = ['created', 'analyzing', 'scripting', 'broll_planning', 'broll_generation', 'influencer_selection', 'casting', 'directing', 'voiceover', 'editing'];
    if (!processingStatuses.includes(project.status)) return;

    let cancelled = false;

    async function poll() {
      await fetchProject();
      if (cancelled) return;
      const delay = failCountRef.current > 0
        ? Math.min(2000 * Math.pow(2, failCountRef.current), 30000)
        : 2000;
      timeoutRef.current = setTimeout(poll, delay);
    }

    timeoutRef.current = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [project?.status, fetchProject]);

  // Clear viewingStage when pipeline advances
  const prevStatusRef = useRef(project?.status);
  useEffect(() => {
    if (project?.status && project.status !== prevStatusRef.current) {
      prevStatusRef.current = project.status;
      setViewingStage(null);
      setEditMode(false);
    }
  }, [project?.status]);

  // Load scene/interaction presets for casting_review editing
  useEffect(() => {
    if (!project || project.status !== 'casting_review') return;
    const catParam = project.product_category ? `?category=${encodeURIComponent(project.product_category)}` : '';
    Promise.all([
      fetch(`/api/scene-presets${catParam}`),
      fetch(`/api/interaction-presets${catParam}`),
    ]).then(async ([sRes, iRes]) => {
      if (sRes.ok) {
        const d = await sRes.json();
        setCastingScenePresets(d.presets || []);
      }
      if (iRes.ok) {
        const d = await iRes.json();
        setCastingInteractionPresets(d.presets || []);
      }
    }).catch(() => {});
    // Pre-populate from project
    setCastingSceneId(project.scene_preset_id || null);
    setCastingSceneOverride(project.scene_override || '');
    setCastingInteractionId(project.interaction_preset_id || null);
    setCastingInteractionOverride(project.interaction_override || '');
  }, [project?.status, project?.product_category]);

  // Retry a stuck stage by re-triggering its entry point
  const handleStageRetry = useCallback(async (stuckStage: string) => {
    if (!project) return;
    try {
      if (stuckStage === 'casting') {
        // Re-trigger casting via select-influencer (works from 'casting' status)
        await fetch(`/api/projects/${projectId}/select-influencer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ influencerId: project.influencer_id }),
        });
      } else {
        // For other stages, try the retry endpoint with stage name
        await fetch(`/api/projects/${projectId}/retry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: stuckStage }),
        });
      }
      fetchProject();
    } catch (err) {
      console.error('Failed to retry stage:', err);
    }
  }, [project, projectId, fetchProject]);

  // Cancel/stop a running stage — rolls back to previous review gate
  const handleStageCancel = useCallback(async () => {
    if (!project) return;
    const rollbackTo = CANCEL_ROLLBACK[project.status];
    const rollbackLabel = rollbackTo
      ? (NAV_STAGE_LABELS[rollbackTo] || rollbackTo)
      : 'previous stage';

    try {
      const res = await fetch(`/api/projects/${projectId}/cancel`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const newStatus = data.status || rollbackTo;
        setCancelToast({ type: 'success', message: `Stopped. Returned to ${rollbackLabel}.` });
        await fetchProject();
        if (newStatus) setViewingStage(null); // show current (rolled-back) stage
      } else {
        const body = await res.json().catch(() => ({}));
        setCancelToast({ type: 'error', message: body.error || 'Failed to cancel — backend endpoint may not be deployed yet.' });
      }
    } catch {
      setCancelToast({ type: 'error', message: 'Network error — could not reach the server.' });
    }

    // Auto-dismiss toast after 5s
    setTimeout(() => setCancelToast(null), 5000);
  }, [project, projectId, fetchProject]);

  // Derived navigation state
  const displayStage = viewingStage || project?.status || '';
  const isViewingPast = viewingStage !== null;
  const readOnlyMode = isViewingPast && !editMode;

  function handleStageClick(stageKey: string) {
    setViewingStage(stageKey);
    setEditMode(false);
  }

  async function handleEditClick() {
    if (!viewingStage) return;
    setImpactLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: viewingStage, changes: ['all'] }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.destructive && data.destructive.length > 0) {
          setImpactData({
            warning: data.warning || 'Editing this stage may require regenerating downstream content.',
            estimatedCost: data.estimatedCost || 0,
            restartFrom: data.restartFrom || null,
            allAffectedStages: data.allAffectedStages || [],
          });
        } else {
          // No destructive impact — enter edit mode directly
          setEditMode(true);
        }
      } else {
        // API error — allow editing anyway
        setEditMode(true);
      }
    } catch {
      // Network error — allow editing anyway
      setEditMode(true);
    } finally {
      setImpactLoading(false);
    }
  }

  // Fetch final video URL when project is completed
  useEffect(() => {
    if (project?.status === 'completed') {
      fetch(`/api/projects/${project.id}/assets`)
        .then(r => r.json())
        .then(data => {
          const segments = data.segments || [];
          for (const seg of segments) {
            for (const asset of (seg as { assets?: { type: string; url?: string }[] }).assets || []) {
              if (asset.type === 'final_video' && asset.url) {
                setFinalVideoUrl(asset.url);
              }
            }
          }
        });
    }
  }, [project?.status, project?.id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/');
      } else {
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleApproveAnalysis() {
    if (!project) return;
    setApproving(true);
    try {
      await fetch(`/api/projects/${projectId}/approve`, { method: 'POST' });
      fetchProject();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setApproving(false);
    }
  }

  async function handleArchive() {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}/archive`, { method: 'POST' });
    if (res.ok) setArchived(true);
  }

  async function handleRegenerateAllKeyframes() {
    if (!project?.influencer_id) return;
    await fetch(`/api/projects/${projectId}/select-influencer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        influencerId: project.influencer_id,
        scenePresetId: castingSceneId || project.scene_preset_id,
        sceneOverride: castingSceneOverride || project.scene_override || undefined,
        interactionPresetId: castingInteractionId || project.interaction_preset_id,
        interactionOverride: castingInteractionOverride || project.interaction_override || undefined,
      }),
    });
    fetchProject();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
            <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-magenta" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="font-[family-name:var(--font-display)] text-sm text-text-muted">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center">
        <p className="text-text-secondary">Project not found.</p>
      </div>
    );
  }

  const data = project.product_data;

  // Build product terms for highlighting mentions in script text
  const productTerms = [
    project.product_name,
    data?.product_name,
    data?.brand,
    data?.product_type,
  ].filter((t): t is string => !!t && t.length >= 3);

  return (
    <BattleHUD status={project.status} costUsd={project.cost_usd} failedAtStatus={project.failed_at_status}>
    <div className="animate-fade-in-up space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {project.project_number != null && (
            <div className="mb-1 flex items-center gap-2">
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wider text-electric/70">
                PROJECT-{project.project_number}
              </p>
              {project.fast_mode && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-hot/30 bg-amber-hot/10 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[9px] font-bold uppercase tracking-wider text-amber-hot" title="Review gates auto-approved. Pipeline runs without pausing for review.">
                  <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 1L3 7h3l-.5 4L9 5H6l.5-4z" />
                  </svg>
                  FAST
                </span>
              )}
            </div>
          )}
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-text-primary">
            {project.product_name || project.name || 'Untitled Project'}
          </h1>
          <a
            href={project.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block truncate font-[family-name:var(--font-mono)] text-xs text-text-muted transition-colors hover:text-electric"
          >
            {project.product_url}
          </a>
          {project.influencer && (
            <Link
              href={`/influencers/${project.influencer.id}`}
              className="mt-2 inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-electric"
            >
              {project.influencer.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.influencer.image_url}
                  alt={project.influencer.name}
                  className="h-6 w-6 rounded-full object-cover border border-border"
                />
              )}
              <span className="font-[family-name:var(--font-display)] text-xs font-medium">
                {project.influencer.name}
              </span>
            </Link>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <StatusBadge status={project.status} />
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-border p-2.5 text-text-muted transition-all hover:border-magenta/40 hover:bg-magenta/5 hover:text-magenta"
            title="Delete project"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12" />
              <path d="M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4" />
              <path d="M12.5 4v9.5a1 1 0 01-1 1h-7a1 1 0 01-1-1V4" />
              <line x1="6.5" y1="7" x2="6.5" y2="11" />
              <line x1="9.5" y1="7" x2="9.5" y2="11" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <PipelineProgress
          status={project.status}
          failedAtStatus={project.failed_at_status}
          onStageClick={handleStageClick}
          viewingStage={viewingStage}
          onCancel={() => setShowCancelConfirm(true)}
        />
      </div>

      {/* Navigation banner when viewing a past stage */}
      {isViewingPast && (
        <div className={`rounded-xl border px-5 py-3 ${editMode ? 'border-amber-hot/30 bg-amber-hot/5' : 'border-electric/30 bg-electric/5'}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 16 16" fill="none" className={`h-4 w-4 ${editMode ? 'text-amber-hot' : 'text-electric'}`} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 8h14M8 1l7 7-7 7" />
              </svg>
              <div className="text-sm">
                <span className="font-[family-name:var(--font-display)] font-semibold text-text-primary">
                  Viewing: {NAV_STAGE_LABELS[viewingStage!] || viewingStage}
                </span>
                <span className="mx-2 text-text-muted">&middot;</span>
                <span className="text-text-secondary">
                  Current: {NAV_STAGE_LABELS[project.status] || project.status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editMode ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-hot/30 bg-amber-hot/10 px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold text-amber-hot">
                  <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 2l3 3L4 11H1V8L7 2z" />
                  </svg>
                  Editing
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleEditClick}
                  disabled={impactLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold text-text-muted transition-all hover:border-electric/30 hover:text-electric disabled:opacity-50"
                >
                  {impactLoading ? (
                    <>
                      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                      </svg>
                      Checking...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 2l3 3L4 11H1V8L7 2z" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setViewingStage(null); setEditMode(false); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-electric px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold text-void transition-all hover:shadow-[0_0_16px_rgba(0,240,255,0.3)]"
              >
                Back to Current
                <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6h8M7 3l3 3-3 3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Settings */}
      <ProjectSettings project={project} onUpdated={fetchProject} />

      {/* Connection warning after consecutive polling failures */}
      {connectionWarning && (
        <p className="mt-2 text-[11px] text-amber-hot/80">
          Connection issues — retrying...
        </p>
      )}

      {/* Error message with recovery actions */}
      {project.status === 'failed' && (
        <FailedRecovery
          projectId={projectId}
          errorMessage={project.error_message}
          failedAtStatus={project.failed_at_status}
          onRecovered={fetchProject}
        />
      )}

      {/* Processing indicator for created/analyzing */}
      {!isViewingPast && (project.status === 'created' || project.status === 'analyzing') && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-8 w-8 flex-shrink-0">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
              <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric-dim" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">
                {project.status === 'created' ? 'Initializing...' : 'Analyzing Product'}
              </h3>
              <p className="mt-0.5 text-sm text-text-secondary">
                {project.status === 'created'
                  ? 'Setting up your project...'
                  : 'Extracting product data and generating content strategy. This typically takes 10-30 seconds.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Scripting processing indicator */}
      {!isViewingPast && project.status === 'scripting' && (
        <ScriptingProgress startedAt={project.updated_at} />
      )}

      {/* Analysis Review */}
      {displayStage === 'analysis_review' && data && (() => {
        // Resolve product image: project field → linked product's 4K image → analysis data
        const resolvedProductImage = project.product_image_url || project.product?.image_url || data.product_image_url || null;
        return (
        <>
          {project.video_analysis && (
            <ReferenceVideoAnalysis projectId={project.id} videoAnalysis={project.video_analysis} />
          )}
          <AnalysisResults
            data={data}
            costUsd={project.cost_usd}
            character={project.character}
            editable={!readOnlyMode}
            projectId={projectId}
            onDataUpdated={fetchProject}
          />
          {!readOnlyMode && (
            <ProductImageSection
              projectId={projectId}
              productImageUrl={resolvedProductImage}
              onImageUpdated={fetchProject}
            />
          )}
          {readOnlyMode ? (
            resolvedProductImage ? (
              <div className="rounded-xl border border-border bg-surface p-5">
                <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Product Image
                </h3>
                <div className="h-32 w-32 overflow-hidden rounded-lg border border-border bg-void">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolvedProductImage}
                    alt="Product"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            ) : null
          ) : (
            <div className="flex items-center justify-between gap-4">
              {!resolvedProductImage && (
                <p className="text-sm text-amber-hot">
                  A product image is required before proceeding.
                </p>
              )}
              <div className="ml-auto">
                <CommandMenu
                  actions={[
                    {
                      label: 'Fight — Generate Script',
                      onClick: handleApproveAnalysis,
                      disabled: !resolvedProductImage,
                      loading: approving,
                      variant: 'primary',
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </>
        );
      })()}

      {/* B-Roll progress indicators */}
      {!isViewingPast && project.status === 'broll_planning' && (
        <StageProgress projectId={projectId} stage="broll_planning" color="electric" onRetry={() => handleStageRetry('broll_planning')} onCancel={() => setShowCancelConfirm(true)} />
      )}
      {!isViewingPast && project.status === 'broll_generation' && (
        <StageProgress projectId={projectId} stage="broll_generation" color="magenta" onRetry={() => handleStageRetry('broll_generation')} onCancel={() => setShowCancelConfirm(true)} />
      )}

      {/* Asset generation progress indicators */}
      {!isViewingPast && project.status === 'casting' && (
        <StageProgress projectId={projectId} stage="casting" color="magenta" onRetry={() => handleStageRetry('casting')} onCancel={() => setShowCancelConfirm(true)} />
      )}
      {!isViewingPast && project.status === 'directing' && (
        <StageProgress projectId={projectId} stage="directing" color="magenta" onRetry={() => handleStageRetry('directing')} onCancel={() => setShowCancelConfirm(true)} />
      )}
      {!isViewingPast && project.status === 'voiceover' && (
        <StageProgress projectId={projectId} stage="voiceover" color="magenta" onRetry={() => handleStageRetry('voiceover')} onCancel={() => setShowCancelConfirm(true)} />
      )}
      {!isViewingPast && project.status === 'editing' && (
        <StageProgress projectId={projectId} stage="editing" color="electric" onRetry={() => handleStageRetry('editing')} onCancel={() => setShowCancelConfirm(true)} />
      )}

      {/* Concept Review */}
      {displayStage === 'concept_review' && (
        <ConceptReview
          projectId={projectId}
          concept={project.concept}
          productData={project.product_data}
          onStatusChange={fetchProject}
          readOnly={readOnlyMode}
        />
      )}

      {/* Script Review */}
      {displayStage === 'script_review' && (
        <ScriptReview projectId={projectId} onStatusChange={fetchProject} readOnly={readOnlyMode} productTerms={productTerms} />
      )}

      {/* B-Roll Storyboard Review */}
      {displayStage === 'broll_review' && (
        <StoryboardView projectId={projectId} projectNumber={project.project_number} onStatusChange={fetchProject} readOnly={readOnlyMode} />
      )}

      {/* Influencer Selection Gate */}
      {displayStage === 'influencer_selection' && (
        <InfluencerSelection
          projectId={projectId}
          currentInfluencerId={project.influencer_id}
          productCategory={project.product_category}
          onSelected={fetchProject}
          readOnly={readOnlyMode}
        />
      )}

      {/* Casting Review */}
      {displayStage === 'casting_review' && (
        <>
          {/* WHERE — Scene */}
          {castingScenePresets.length > 0 && (
            <PresetSelector
              step={2}
              title="Where"
              subtitle="Scene"
              presets={castingScenePresets}
              selectedId={castingSceneId}
              onSelect={(id) => {
                setCastingSceneId(id);
                setCastingSceneOverride('');
                fetch(`/api/projects/${projectId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scene_preset_id: id, scene_override: null }),
                });
              }}
              customText={castingSceneOverride}
              onCustomTextChange={(text) => {
                setCastingSceneOverride(text);
                fetch(`/api/projects/${projectId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scene_override: text || null }),
                });
              }}
              productCategory={project.product_category}
              readOnly={readOnlyMode}
              presetType="scene"
              onPresetUpdate={(updated) =>
                setCastingScenePresets((prev) =>
                  prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
                )
              }
            />
          )}

          {/* HOW — Interaction */}
          {castingInteractionPresets.length > 0 && (
            <PresetSelector
              step={3}
              title="How"
              subtitle="Interaction"
              presets={castingInteractionPresets}
              selectedId={castingInteractionId}
              onSelect={(id) => {
                setCastingInteractionId(id);
                setCastingInteractionOverride('');
                fetch(`/api/projects/${projectId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ interaction_preset_id: id, interaction_override: null }),
                });
              }}
              customText={castingInteractionOverride}
              onCustomTextChange={(text) => {
                setCastingInteractionOverride(text);
                fetch(`/api/projects/${projectId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ interaction_override: text || null }),
                });
              }}
              productCategory={project.product_category}
              readOnly={readOnlyMode}
              presetType="interaction"
              onPresetUpdate={(updated) =>
                setCastingInteractionPresets((prev) =>
                  prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
                )
              }
            />
          )}

          <NegativePromptPanel
            projectId={projectId}
            negativePromptOverride={project.negative_prompt_override}
            onSaved={fetchProject}
            readOnly={readOnlyMode}
          />
          <LockCameraToggle
            projectId={projectId}
            lockCamera={!!project.lock_camera}
            onUpdated={fetchProject}
            readOnly={readOnlyMode}
          />
          <KeyframeChainingToggle
            projectId={projectId}
            chainingEnabled={project.keyframe_chaining !== false}
            onUpdated={fetchProject}
            readOnly={readOnlyMode}
          />
          <AssetReview
            projectId={projectId}
            projectNumber={project.project_number}
            onStatusChange={fetchProject}
            confirmBeforeApprove={{
              title: 'Generate Videos?',
              description: 'This will generate video segments using Kling 3.0 Pro and voiceover audio using ElevenLabs. Video generation takes 2-5 minutes per segment.',
              cost: '~$1.25',
            }}
            onRegenerateAll={handleRegenerateAllKeyframes}
            readOnly={readOnlyMode}
            stage="casting_review"
            costPerSegment={project.video_model?.cost_per_segment}
          />
        </>
      )}

      {/* Asset Review */}
      {displayStage === 'asset_review' && (
        <AssetReview projectId={projectId} projectNumber={project.project_number} onStatusChange={fetchProject} readOnly={readOnlyMode} />
      )}

      {/* Completed - Final Review */}
      {project.status === 'completed' && (
        <div className="space-y-6">
          <h2 className="animate-victory-fanfare font-[family-name:var(--font-display)] text-2xl font-bold text-lime">
            VICTORY
          </h2>

          {finalVideoUrl ? (
            <div className="mx-auto max-w-sm">
              <video
                src={finalVideoUrl}
                controls
                className="w-full rounded-xl border border-border aspect-[9/16]"
              />
            </div>
          ) : (
            <p className="text-text-muted text-sm">No final video found.</p>
          )}

          <div className="flex gap-3">
            {finalVideoUrl && (
              <button
                type="button"
                onClick={() => {
                  const fn = project.project_number
                    ? finalVideoFilename(project.project_number)
                    : 'final-video.mp4';
                  downloadAsset(finalVideoUrl, fn);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:bg-electric/90 hover:shadow-[0_0_24px_rgba(0,240,255,0.3)]"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
                </svg>
                Download Video
              </button>
            )}
            {finalVideoUrl && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(finalVideoUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric hover:border-electric/30"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <rect x="5" y="5" width="9" height="9" rx="1.5" />
                  <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
                </svg>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            )}
            <button
              onClick={handleArchive}
              disabled={archived}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-medium text-text-secondary transition-colors hover:text-electric hover:border-electric/30 disabled:opacity-50"
            >
              {archived ? 'Archived' : 'Archive Run'}
            </button>
          </div>

          {/* Reference Comparison — shown only when a SEAL reference video was used */}
          {project.video_analysis && finalVideoUrl && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const va = project.video_analysis as any;
            const hookType = va.hook?.type;
            const energyArc = va.overall?.energyArc;
            const dominantStyle = va.overall?.dominantStyle;
            const referenceVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/projects/${project.id}/reference.mp4`;

            return (
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-4 flex items-center gap-3">
                  <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-text-primary">
                    Reference Comparison
                  </h3>
                  <span className="inline-flex items-center rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-wider text-electric ring-1 ring-inset ring-electric/20">
                    SEAL
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Reference Video */}
                  <div>
                    <p className="mb-2 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Reference
                    </p>
                    <video
                      controls
                      className="w-full rounded-lg border border-border aspect-[9/16] bg-void"
                      src={referenceVideoUrl}
                    >
                      <track kind="captions" />
                    </video>
                  </div>

                  {/* Generated Video */}
                  <div>
                    <p className="mb-2 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Generated
                    </p>
                    <video
                      controls
                      className="w-full rounded-lg border border-border aspect-[9/16] bg-void"
                      src={finalVideoUrl}
                    >
                      <track kind="captions" />
                    </video>
                  </div>
                </div>

                {/* SEAL Elements Matched */}
                {(hookType || energyArc || dominantStyle) && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      SEAL Elements Matched:
                    </span>
                    {hookType && (
                      <span className="inline-flex rounded-md bg-magenta/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-magenta ring-1 ring-inset ring-magenta/20">
                        Hook: {hookType}
                      </span>
                    )}
                    {energyArc && (
                      <span className="inline-flex rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-electric ring-1 ring-inset ring-electric/20">
                        Energy: {energyArc}
                      </span>
                    )}
                    {dominantStyle && (
                      <span className="inline-flex rounded-md bg-lime/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-medium text-lime ring-1 ring-inset ring-lime/20">
                        Style: {dominantStyle}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="glass rounded-xl border border-border p-6">
            <h3 className="mb-4 font-[family-name:var(--font-display)] text-xs font-semibold text-text-muted uppercase tracking-wider">
              Recipe
            </h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-text-muted">Product</dt>
                <dd className="text-text-primary">{project.product_name || '\u2014'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Category</dt>
                <dd className="text-text-primary">{project.product_category || '\u2014'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Total Gil</dt>
                <dd className="font-medium"><GilDisplay amount={project.cost_usd} /></dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Impact confirmation dialog for editing past stages */}
      {impactData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-fade-in-up rounded-xl border border-amber-hot/30 bg-surface p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-hot/10">
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1L1 14h14L8 1z" />
                  <path d="M8 6v4" />
                  <circle cx="8" cy="12" r="0.5" fill="currentColor" />
                </svg>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-text-primary">
                Changes May Require Regeneration
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              {impactData.warning}
            </p>
            {impactData.estimatedCost > 0 && (
              <div className="mt-3 rounded-lg bg-surface-overlay px-3 py-2">
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Estimated Cost
                </span>
                <p className="font-[family-name:var(--font-mono)] text-lg font-bold text-amber-hot">
                  ~{impactData.estimatedCost.toFixed(2)} Gil
                </p>
              </div>
            )}
            {impactData.allAffectedStages.length > 0 && (
              <div className="mt-3">
                <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Affected Stages
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {impactData.allAffectedStages.map((s) => (
                    <span key={s} className="rounded-md bg-amber-hot/10 px-2 py-0.5 font-[family-name:var(--font-display)] text-[10px] font-medium text-amber-hot">
                      {NAV_STAGE_LABELS[s] || STAGE_LABELS[s] || s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setImpactData(null)}
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-text-secondary transition-all hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setImpactData(null); setEditMode(true); }}
                className="flex-1 rounded-lg bg-amber-hot px-4 py-2.5 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,171,0,0.25)]"
              >
                I Understand, Edit
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.product_name || project.name || 'this project'}"? All scripts, assets, and generated content will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={deleting}
      />

      <ConfirmDialog
        open={showCancelConfirm}
        title="Stop Generation"
        description={`Stop the current ${STAGE_LABELS[project.status] || project.status} stage? You'll be returned to ${CANCEL_ROLLBACK[project.status] ? (NAV_STAGE_LABELS[CANCEL_ROLLBACK[project.status]] || CANCEL_ROLLBACK[project.status]) : 'the previous review step'}.`}
        onConfirm={async () => {
          setShowCancelConfirm(false);
          await handleStageCancel();
        }}
        onCancel={() => setShowCancelConfirm(false)}
      />

      {/* Cancel toast notification */}
      {cancelToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 shadow-lg ${
            cancelToast.type === 'success'
              ? 'border-electric/30 bg-surface-raised text-electric'
              : 'border-magenta/30 bg-surface-raised text-magenta'
          }`}>
            {cancelToast.type === 'success' ? (
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 flex-shrink-0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <circle cx="8" cy="8" r="6.5" />
                <path d="M5.5 8.5l2 2 3.5-4" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 flex-shrink-0" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 5v4" />
                <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
              </svg>
            )}
            <span className="text-sm">{cancelToast.message}</span>
            <button
              type="button"
              onClick={() => setCancelToast(null)}
              className="ml-1 text-text-muted transition-colors hover:text-text-secondary"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
    </BattleHUD>
  );
}

/* ==============================
   Reference Video Analysis (SEAL)
   ============================== */

const SEAL_COLORS = {
  S: { bg: 'bg-electric/15', text: 'text-electric', border: 'border-electric/30' },
  E: { bg: 'bg-magenta/15', text: 'text-magenta', border: 'border-magenta/30' },
  A: { bg: 'bg-amber-hot/15', text: 'text-amber-hot', border: 'border-amber-hot/30' },
  L: { bg: 'bg-lime/15', text: 'text-lime', border: 'border-lime/30' },
} as const;

interface ReferenceVideoAnalysisProps {
  projectId: string;
  videoAnalysis: Record<string, unknown>;
}

function ReferenceVideoAnalysis({ projectId, videoAnalysis }: ReferenceVideoAnalysisProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const va = videoAnalysis as any;
  const hook = va.hook;
  const segments = va.segments || [];
  const overall = va.overall;

  const referenceVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/assets/projects/${projectId}/reference.mp4`;

  return (
    <div className="stagger-children space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-text-primary">
          Reference Video Analysis
        </h2>
        <span className="inline-flex items-center rounded-md bg-electric/10 px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] font-semibold uppercase tracking-wider text-electric ring-1 ring-inset ring-electric/20">
          SEAL Method
        </span>
      </div>

      {/* Reference Video Player */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
          Reference Video
        </h3>
        <video
          controls
          className="w-full max-w-md mx-auto rounded-lg border border-border"
          src={referenceVideoUrl}
        >
          <track kind="captions" />
        </video>
      </div>

      {/* Hook Card */}
      {hook && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
              Hook Analysis
            </h3>
            {hook.type && (
              <span className="inline-flex rounded-md bg-magenta/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] font-semibold text-magenta ring-1 ring-inset ring-magenta/20">
                {hook.type}
              </span>
            )}
            {hook.durationSeconds != null && (
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                {hook.durationSeconds}s
              </span>
            )}
          </div>
          {hook.technique && (
            <p className="text-sm text-text-secondary">{hook.technique}</p>
          )}
          {hook.text && (
            <p className="mt-2 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm italic text-text-primary">
              &ldquo;{hook.text}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* SEAL Segment Cards */}
      {segments.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {segments.map((seg: any) => (
            <div key={seg.index} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-[family-name:var(--font-display)] text-sm font-semibold text-text-primary">
                  Segment {seg.index + 1}
                </h4>
                <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
                  {seg.startTime}s &ndash; {seg.endTime}s
                </span>
              </div>

              {seg.description && (
                <p className="mb-3 text-xs text-text-secondary leading-relaxed">{seg.description}</p>
              )}

              <div className="space-y-3">
                {/* S - Scene */}
                {seg.scene && (
                  <div className="flex items-start gap-2.5">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-[family-name:var(--font-display)] text-[11px] font-bold ${SEAL_COLORS.S.bg} ${SEAL_COLORS.S.text}`}>
                      S
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Scene
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {[seg.scene.setting, seg.scene.composition].filter(Boolean).join(' \u00B7 ')}
                      </p>
                      {seg.scene.productPresence && (
                        <span className={`mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${SEAL_COLORS.S.bg} ${SEAL_COLORS.S.text}`}>
                          Product: {seg.scene.productPresence}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* E - Emotion */}
                {seg.emotion && (
                  <div className="flex items-start gap-2.5">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-[family-name:var(--font-display)] text-[11px] font-bold ${SEAL_COLORS.E.bg} ${SEAL_COLORS.E.text}`}>
                      E
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Emotion
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {[seg.emotion.mood, seg.emotion.pacing].filter(Boolean).join(' \u00B7 ')}
                      </p>
                      {seg.emotion.energy && (
                        <span className={`mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${SEAL_COLORS.E.bg} ${SEAL_COLORS.E.text}`}>
                          Energy: {seg.emotion.energy}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* A - Angle */}
                {seg.angle && (
                  <div className="flex items-start gap-2.5">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-[family-name:var(--font-display)] text-[11px] font-bold ${SEAL_COLORS.A.bg} ${SEAL_COLORS.A.text}`}>
                      A
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Angle
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {[seg.angle.shotType, seg.angle.cameraMovement].filter(Boolean).join(' \u00B7 ')}
                      </p>
                    </div>
                  </div>
                )}

                {/* L - Lighting */}
                {seg.lighting && (
                  <div className="flex items-start gap-2.5">
                    <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md font-[family-name:var(--font-display)] text-[11px] font-bold ${SEAL_COLORS.L.bg} ${SEAL_COLORS.L.text}`}>
                      L
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        Lighting
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {[seg.lighting.style, seg.lighting.colorTemp, seg.lighting.contrast].filter(Boolean).join(' \u00B7 ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overall Analysis Card */}
      {overall && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
            Overall Analysis
          </h3>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {overall.energyArc && (
              <div>
                <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Energy Arc
                </dt>
                <dd className="mt-1 text-sm text-text-primary">{overall.energyArc}</dd>
              </div>
            )}
            {overall.dominantStyle && (
              <div>
                <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Dominant Style
                </dt>
                <dd className="mt-1 text-sm text-text-primary">{overall.dominantStyle}</dd>
              </div>
            )}
            {overall.musicPresence != null && (
              <div>
                <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Music
                </dt>
                <dd className="mt-1 text-sm text-text-primary">
                  {overall.musicPresence ? 'Yes' : 'No'}
                </dd>
              </div>
            )}
            {overall.textOverlayStyle && (
              <div>
                <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Text Overlay
                </dt>
                <dd className="mt-1 text-sm text-text-primary">{overall.textOverlayStyle}</dd>
              </div>
            )}
            {overall.viralPattern && (
              <div>
                <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Viral Pattern
                </dt>
                <dd className="mt-1">
                  <span className="inline-flex rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-electric">
                    {overall.viralPattern}
                  </span>
                </dd>
              </div>
            )}
            {overall.estimatedDuration && (
              <div>
                <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Duration
                </dt>
                <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                  {overall.estimatedDuration}s
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}

/* ==============================
   Analysis Results Sub-component
   ============================== */

interface AnalysisResultsProps {
  data: NonNullable<ProjectData['product_data']>;
  costUsd: string | null;
  character: { name: string; avatar_persona: string | null } | null;
  editable?: boolean;
  projectId?: string;
  onDataUpdated?: () => void;
}

const ANALYSIS_TEXT_FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: 'usage', label: 'Usage', multiline: true },
  { key: 'hook_angle', label: 'Hook Angle', multiline: true },
  { key: 'avatar_description', label: 'Avatar Description', multiline: true },
];

const ANALYSIS_ARRAY_FIELDS: Array<{ key: string; label: string; dotColor: string }> = [
  { key: 'selling_points', label: 'Selling Points', dotColor: 'bg-magenta' },
  { key: 'key_claims', label: 'Key Claims', dotColor: 'bg-lime' },
  { key: 'benefits', label: 'Benefits', dotColor: 'bg-amber-hot' },
];

function AnalysisResults({ data, costUsd, character, editable = false, projectId, onDataUpdated }: AnalysisResultsProps) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenFeedback, setRegenFeedback] = useState<{ field: string; text: string } | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editArrays, setEditArrays] = useState<Record<string, string[]>>({});

  // Sync edit state when data changes
  useEffect(() => {
    setEditValues({
      usage: data.usage || '',
      hook_angle: data.hook_angle || '',
      avatar_description: data.avatar_description || '',
    });
    setEditArrays({
      selling_points: data.selling_points || [],
      key_claims: data.key_claims || [],
      benefits: data.benefits || [],
    });
  }, [data]);

  async function saveField(field: string, value: string | string[]) {
    if (!projectId) return;
    setSaving(field);
    try {
      const updatedData = { ...data, [field]: value };
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_data: updatedData }),
      });
      if (res.ok) onDataUpdated?.();
    } finally {
      setSaving(null);
    }
  }

  async function regenerateField(field: string, feedback?: string) {
    if (!projectId) return;
    setRegenerating(field);
    setRegenFeedback(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/regenerate-field`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, feedback: feedback || undefined }),
      });
      if (res.ok) {
        const result = await res.json();
        // Update local state with regenerated value
        if (Array.isArray(result.value)) {
          setEditArrays((v) => ({ ...v, [field]: result.value }));
        } else {
          setEditValues((v) => ({ ...v, [field]: result.value }));
        }
        onDataUpdated?.();
      }
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="stagger-children space-y-5">
      {/* Product Info Grid */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">
            Product Analysis
          </h2>
          {editable && (
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`rounded-lg px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium transition-all ${
                editMode
                  ? 'bg-electric font-semibold text-void'
                  : 'border border-border text-text-secondary hover:text-electric hover:border-electric/30'
              }`}
            >
              {editMode ? 'Done Editing' : 'Edit Analysis'}
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data.brand && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Brand
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.brand}</dd>
            </div>
          )}
          {data.product_type && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Type
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.product_type}</dd>
            </div>
          )}
          {data.product_size && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Size
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.product_size}</dd>
            </div>
          )}
          {data.product_price && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Price
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{data.product_price}</dd>
            </div>
          )}
          {data.category && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Category
              </dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-md bg-electric/10 px-2 py-0.5 font-[family-name:var(--font-mono)] text-xs text-electric">
                  {data.category}
                </span>
              </dd>
            </div>
          )}
          {costUsd && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Cost
              </dt>
              <dd className="mt-1 font-[family-name:var(--font-mono)] text-sm text-text-primary">
                ${parseFloat(costUsd).toFixed(4)}
              </dd>
            </div>
          )}
          {character && (
            <div>
              <dt className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Character
              </dt>
              <dd className="mt-1 text-sm text-text-primary">{character.name}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Array fields (Selling Points, Key Claims, Benefits) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ANALYSIS_ARRAY_FIELDS.map((field) => {
          const items = editMode ? (editArrays[field.key] || []) : ((data as unknown as Record<string, string[]>)[field.key] || []);
          if (!editMode && items.length === 0) return null;

          return (
            <div key={field.key} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {field.label}
                </h3>
                {saving === field.key && (
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-electric">Saving...</span>
                )}
                {regenerating === field.key && (
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-magenta animate-pulse">Regenerating...</span>
                )}
                {editMode && regenerating !== field.key && (
                  <button
                    type="button"
                    title="Regenerate with AI ($0.01)"
                    onClick={() => setRegenFeedback(regenFeedback?.field === field.key ? null : { field: field.key, text: '' })}
                    className="ml-auto rounded p-1 text-text-muted transition-colors hover:bg-magenta/10 hover:text-magenta"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v5h5" />
                      <path d="M15 12V7h-5" />
                      <path d="M13.5 5.5A6 6 0 002.3 8" />
                      <path d="M2.5 10.5A6 6 0 0013.7 8" />
                    </svg>
                  </button>
                )}
              </div>
              {regenFeedback?.field === field.key && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Optional feedback for AI..."
                    value={regenFeedback.text}
                    onChange={(e) => setRegenFeedback({ field: field.key, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') regenerateField(field.key, regenFeedback.text); }}
                    className="flex-1 rounded-lg border border-magenta/30 bg-surface-raised px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-magenta focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => regenerateField(field.key, regenFeedback.text)}
                    className="rounded-lg bg-magenta/10 px-2.5 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-magenta transition-colors hover:bg-magenta/20"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegenFeedback(null)}
                    className="rounded p-1 text-text-muted hover:text-text-secondary"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </div>
              )}

              {editMode ? (
                <div className="space-y-2">
                  {(editArrays[field.key] || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${field.dotColor}`} />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...(editArrays[field.key] || [])];
                          updated[i] = e.target.value;
                          setEditArrays((v) => ({ ...v, [field.key]: updated }));
                        }}
                        onBlur={() => saveField(field.key, editArrays[field.key] || [])}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveField(field.key, editArrays[field.key] || []);
                          }
                        }}
                        className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editArrays[field.key] || []).filter((_, idx) => idx !== i);
                          setEditArrays((v) => ({ ...v, [field.key]: updated }));
                          saveField(field.key, updated);
                        }}
                        className="rounded p-1 text-text-muted transition-colors hover:text-magenta"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <line x1="4" y1="4" x2="12" y2="12" />
                          <line x1="12" y1="4" x2="4" y2="12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(editArrays[field.key] || []), ''];
                      setEditArrays((v) => ({ ...v, [field.key]: updated }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="8" y1="3" x2="8" y2="13" />
                      <line x1="3" y1="8" x2="13" y2="8" />
                    </svg>
                    Add item
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                      <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${field.dotColor}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {/* Text fields (Usage, Hook Angle, Avatar Description) — in grid */}
        {ANALYSIS_TEXT_FIELDS.map((tf) => {
          const value = (data as unknown as Record<string, string>)[tf.key] || '';
          if (!editMode && !value) return null;
          return (
            <div key={tf.key} className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {tf.label}
                </h3>
                {saving === tf.key && (
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-electric">Saving...</span>
                )}
                {regenerating === tf.key && (
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-magenta animate-pulse">Regenerating...</span>
                )}
                {editMode && regenerating !== tf.key && (
                  <button
                    type="button"
                    title="Regenerate with AI ($0.01)"
                    onClick={() => setRegenFeedback(regenFeedback?.field === tf.key ? null : { field: tf.key, text: '' })}
                    className="ml-auto rounded p-1 text-text-muted transition-colors hover:bg-magenta/10 hover:text-magenta"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v5h5" />
                      <path d="M15 12V7h-5" />
                      <path d="M13.5 5.5A6 6 0 002.3 8" />
                      <path d="M2.5 10.5A6 6 0 0013.7 8" />
                    </svg>
                  </button>
                )}
              </div>
              {regenFeedback?.field === tf.key && (
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Optional feedback for AI..."
                    value={regenFeedback.text}
                    onChange={(e) => setRegenFeedback({ field: tf.key, text: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') regenerateField(tf.key, regenFeedback.text); }}
                    className="flex-1 rounded-lg border border-magenta/30 bg-surface-raised px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-magenta focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => regenerateField(tf.key, regenFeedback.text)}
                    className="rounded-lg bg-magenta/10 px-2.5 py-1.5 font-[family-name:var(--font-display)] text-[10px] font-semibold text-magenta transition-colors hover:bg-magenta/20"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegenFeedback(null)}
                    className="rounded p-1 text-text-muted hover:text-text-secondary"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </div>
              )}
              {editMode ? (
                <textarea
                  value={editValues[tf.key] || ''}
                  onChange={(e) => setEditValues((v) => ({ ...v, [tf.key]: e.target.value }))}
                  onBlur={() => saveField(tf.key, editValues[tf.key] || '')}
                  rows={tf.multiline ? 3 : 2}
                  className="w-full rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric resize-none"
                />
              ) : (
                <p className="text-sm leading-relaxed text-text-secondary">{value}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==============================
   Product Image Section
   ============================== */

interface ProductImageSectionProps {
  projectId: string;
  productImageUrl: string | null;
  onImageUpdated: () => void;
}

function ProductImageSection({ projectId, productImageUrl, onImageUpdated }: ProductImageSectionProps) {
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const hasValidImage = !!productImageUrl && !imageError;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');

    try {
      // Upload directly to storage
      const { path } = await uploadToStorage(file, 'project-product', projectId);

      // Update project record with storage path
      const res = await fetch(`/api/projects/${projectId}/product-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: path }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setImageError(false);
      onImageUpdated();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      e.target.value = '';
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-text-muted">
        Product Image
      </h3>

      {hasValidImage ? (
        <div className="flex items-start gap-5">
          <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-void">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageUrl}
              alt="Product"
              className="h-full w-full object-contain"
              onError={() => setImageError(true)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-secondary">
              Image extracted from product page.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric">
              {uploading ? 'Uploading...' : 'Replace Image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-amber-hot/30 bg-amber-hot/5 p-6">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-amber-hot" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          <p className="text-center text-sm text-text-secondary">
            {productImageUrl && imageError
              ? 'The extracted image could not be loaded. Please upload a product image.'
              : 'No product image found. Upload one to continue.'}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-hot px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,160,0,0.3)]">
            {uploading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M8 12V4M4 7l4-4 4 4M2 14h12" />
                </svg>
                Upload Product Image
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {uploadError && (
        <p className="mt-2 text-sm text-magenta">{uploadError}</p>
      )}
    </div>
  );
}

/* ==============================
   Influencer Selection Gate
   ============================== */

interface InfluencerOption {
  id: string;
  name: string;
  persona: string | null;
  image_url: string | null;
  voice_id: string | null;
  voice_preview_url: string | null;
}

interface InfluencerSelectionProps {
  projectId: string;
  currentInfluencerId: string | null;
  productCategory: string | null;
  onSelected: () => void;
  readOnly?: boolean;
}

function InfluencerSelection({ projectId, currentInfluencerId, productCategory, onSelected, readOnly }: InfluencerSelectionProps) {
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [selectedId, setSelectedId] = useState(currentInfluencerId || '');
  const [loadingList, setLoadingList] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [productPlacement, setProductPlacement] = useState([
    { segment: 0, visibility: 'none', notes: '' },
    { segment: 1, visibility: 'subtle', notes: '' },
    { segment: 2, visibility: 'hero', notes: '' },
    { segment: 3, visibility: 'set_down', notes: '' },
  ]);
  const [scenePresets, setScenePresets] = useState<Preset[]>([]);
  const [interactionPresets, setInteractionPresets] = useState<Preset[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneOverride, setSceneOverride] = useState('');
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);
  const [interactionOverride, setInteractionOverride] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  function handleVoicePlay(e: React.MouseEvent, inf: InfluencerOption) {
    e.stopPropagation();
    if (!inf.voice_preview_url) return;
    if (playingVoiceId === inf.id && voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
      return;
    }
    if (!voiceAudioRef.current) {
      voiceAudioRef.current = new Audio();
      voiceAudioRef.current.addEventListener('ended', () => setPlayingVoiceId(null));
    }
    voiceAudioRef.current.pause();
    voiceAudioRef.current.src = inf.voice_preview_url;
    voiceAudioRef.current.play().catch(() => setPlayingVoiceId(null));
    setPlayingVoiceId(inf.id);
  }

  useEffect(() => {
    fetch('/api/influencers?hasImage=true&hasVoice=true')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setInfluencers(data);
        // Pre-select current if set, otherwise first available
        if (!currentInfluencerId && data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch(() => setInfluencers([]))
      .finally(() => setLoadingList(false));

    // Fetch scene + interaction presets
    const catParam = productCategory ? `?category=${encodeURIComponent(productCategory)}` : '';
    Promise.all([
      fetch(`/api/scene-presets${catParam}`),
      fetch(`/api/interaction-presets${catParam}`),
    ]).then(async ([sRes, iRes]) => {
      if (sRes.ok) {
        const d = await sRes.json();
        setScenePresets(d.presets || []);
        const def = (d.presets || []).find((p: Preset) => p.is_default);
        if (def) setSelectedSceneId(def.id);
      }
      if (iRes.ok) {
        const d = await iRes.json();
        setInteractionPresets(d.presets || []);
        const def = (d.presets || []).find((p: Preset) => p.is_default);
        if (def) setSelectedInteractionId(def.id);
      }
    }).catch(() => {});
  }, [currentInfluencerId, productCategory]);

  async function handleConfirm() {
    if (!selectedId || confirming) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/select-influencer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: selectedId,
          productPlacement,
          scenePresetId: sceneOverride ? undefined : selectedSceneId || undefined,
          sceneOverride: sceneOverride || undefined,
          interactionPresetId: interactionOverride ? undefined : selectedInteractionId || undefined,
          interactionOverride: interactionOverride || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          throw new Error(data.error || 'This project is already being processed. Please wait for casting to complete.');
        }
        throw new Error(data.error || 'Failed to select influencer');
      }
      // Success — keep button disabled (confirming=true) until the view transitions
      // to the casting progress screen via onSelected(). Do NOT re-enable.
      onSelected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select influencer');
      setConfirming(false);
    }
  }

  const selected = influencers.find((i) => i.id === selectedId);

  if (loadingList) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-electric border-t-transparent" />
          <span className="text-sm text-text-secondary">Loading influencers...</span>
        </div>
      </div>
    );
  }

  if (influencers.length === 0) {
    return (
      <div className="rounded-xl border border-amber-hot/30 bg-amber-hot/5 p-6">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-amber-hot">
          No Influencers Ready
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          No influencers ready. Influencers need both a reference image and a designed voice to be selected.
        </p>
        <a
          href="/influencers/new"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-hot px-4 py-2 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_24px_rgba(255,160,0,0.3)]"
        >
          Create Influencer
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Step 1: WHO */}
      <div className="rounded-xl border border-electric/20 bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">1</span>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-electric">Who</h2>
          <span className="text-xs text-text-muted">&mdash; Select Influencer</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {influencers.map((inf) => {
            const isSelected = selectedId === inf.id;
            const hasImage = !!inf.image_url;
            return (
              <button
                key={inf.id}
                type="button"
                onClick={() => !readOnly && hasImage && setSelectedId(inf.id)}
                disabled={!hasImage || readOnly}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-electric bg-electric/5 ring-1 ring-electric/30'
                    : hasImage && !readOnly
                      ? 'border-border bg-surface-raised hover:border-border-bright'
                      : 'border-border/50 bg-surface-raised opacity-50 cursor-not-allowed'
                }`}
              >
                {/* Image */}
                <div className="aspect-[3/4] w-full overflow-hidden bg-void">
                  {inf.image_url ? (
                    <img
                      src={inf.image_url}
                      alt={inf.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-text-muted" stroke="currentColor" strokeWidth={1.5}>
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary truncate">
                      {inf.name}
                    </p>
                    {/* Voice preview icon */}
                    {inf.voice_preview_url && (
                      <button
                        type="button"
                        onClick={(e) => handleVoicePlay(e, inf)}
                        className={`flex-shrink-0 rounded p-0.5 transition-all ${
                          playingVoiceId === inf.id
                            ? 'text-lime bg-lime/15'
                            : 'text-lime/60 hover:text-lime hover:bg-lime/10'
                        }`}
                        title={playingVoiceId === inf.id ? 'Stop' : 'Preview voice'}
                      >
                        <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          {playingVoiceId === inf.id ? (
                            <>
                              <rect x="2.5" y="2.5" width="2.5" height="7" fill="currentColor" stroke="none" rx="0.5" />
                              <rect x="7" y="2.5" width="2.5" height="7" fill="currentColor" stroke="none" rx="0.5" />
                            </>
                          ) : (
                            <path d="M6 1v10M3.5 3.5L2 6l1.5 2.5M8.5 3.5L10 6 8.5 8.5" />
                          )}
                        </svg>
                      </button>
                    )}
                  </div>
                  {inf.persona && (
                    <p className="mt-0.5 text-[10px] text-text-muted truncate">{inf.persona}</p>
                  )}
                  {!hasImage && (
                    <p className="mt-0.5 text-[10px] text-magenta">No image</p>
                  )}
                </div>
                {/* Selection checkmark */}
                {isSelected && (
                  <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-electric">
                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-void" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3.5 8 6.5 11 12.5 5" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: WHERE — Scene Preset */}
      {scenePresets.length > 0 && (
        <PresetSelector
          step={2}
          title="Where"
          subtitle="Choose Scene"
          presets={scenePresets}
          selectedId={selectedSceneId}
          onSelect={setSelectedSceneId}
          customText={sceneOverride}
          onCustomTextChange={setSceneOverride}
          productCategory={productCategory}
          readOnly={readOnly}
          presetType="scene"
          onPresetUpdate={(updated) =>
            setScenePresets((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            )
          }
        />
      )}

      {/* Step 3: HOW — Interaction Preset */}
      {interactionPresets.length > 0 && (
        <PresetSelector
          step={3}
          title="How"
          subtitle="Choose Interaction"
          presets={interactionPresets}
          selectedId={selectedInteractionId}
          onSelect={setSelectedInteractionId}
          customText={interactionOverride}
          onCustomTextChange={setInteractionOverride}
          productCategory={productCategory}
          readOnly={readOnly}
          presetType="interaction"
          onPresetUpdate={(updated) =>
            setInteractionPresets((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            )
          }
        />
      )}

      {/* Step 4: Product Placement Per Segment */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric/15 font-[family-name:var(--font-mono)] text-xs font-bold text-electric">4</span>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wider text-text-muted">Product Placement</h2>
        </div>
        <div className="space-y-3">
          {productPlacement.map((seg, i) => {
            const sectionLabels = ['Hook', 'Problem', 'Solution + Product', 'CTA'];
            return (
              <div key={seg.segment} className="rounded-lg border border-border bg-surface-raised p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-overlay font-[family-name:var(--font-mono)] text-[10px] font-bold text-text-muted">
                    {seg.segment + 1}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-primary">
                    {sectionLabels[i]}
                  </span>
                  <select
                    value={seg.visibility}
                    onChange={(e) => {
                      const updated = [...productPlacement];
                      updated[i] = { ...updated[i], visibility: e.target.value };
                      setProductPlacement(updated);
                    }}
                    disabled={readOnly}
                    className="ml-auto appearance-none rounded-md border border-border bg-surface px-2.5 py-1 font-[family-name:var(--font-mono)] text-[11px] text-text-secondary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:opacity-50"
                  >
                    <option value="none">Not visible</option>
                    <option value="subtle">Subtle / Background</option>
                    <option value="hero">Hero shot</option>
                    <option value="set_down">In frame</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={seg.notes}
                  onChange={(e) => {
                    const updated = [...productPlacement];
                    updated[i] = { ...updated[i], notes: e.target.value };
                    setProductPlacement(updated);
                  }}
                  disabled={readOnly}
                  placeholder="Optional: e.g. 'holds bottle at eye level'"
                  className="mt-2 block w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric disabled:opacity-50"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost estimate + confirm */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-text-muted">
          {selected && (
            <span>
              Selected: <span className="text-text-primary font-medium">{selected.name}</span>
              {' '}&middot;{' '}
              <span className="text-text-muted">Estimated cost: ~$0.56 for keyframes</span>
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || confirming}
            className="inline-flex items-center gap-2 rounded-lg bg-lime px-6 py-3 font-[family-name:var(--font-display)] text-sm font-semibold text-void transition-all hover:shadow-[0_0_32px_rgba(184,255,0,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirming ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                </svg>
                Confirming...
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3.5 8 6.5 11 12.5 5" />
                </svg>
                Confirm &amp; Generate Keyframes
              </>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-4 py-3">
          <p className="text-sm text-magenta">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ==============================
   Failed Recovery Sub-component
   ============================== */

const STAGE_LABELS: Record<string, string> = {
  analyzing: 'Product Analysis',
  scripting: 'Script Generation',
  broll_planning: 'B-Roll Planning',
  broll_review: 'B-Roll Review',
  broll_generation: 'B-Roll Generation',
  casting: 'Keyframe Casting',
  directing: 'Video Directing',
  voiceover: 'Voiceover Generation',
  editing: 'Video Composition',
};

const ROLLBACK_LABELS: Record<string, string> = {
  analyzing: 'Start',
  scripting: 'Analysis Review',
  broll_planning: 'Script Review',
  broll_review: 'Script Review',
  broll_generation: 'B-Roll Review',
  casting: 'Influencer Selection',
  directing: 'Casting Review',
  voiceover: 'Casting Review',
  editing: 'Asset Review',
};

interface FailedRecoveryProps {
  projectId: string;
  errorMessage: string | null;
  failedAtStatus: string | null;
  onRecovered: () => void;
}

function FailedRecovery({ projectId, errorMessage, failedAtStatus, onRecovered }: FailedRecoveryProps) {
  const [retrying, setRetrying] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const stageLabel = failedAtStatus ? STAGE_LABELS[failedAtStatus] || failedAtStatus : 'Unknown';
  const rollbackLabel = failedAtStatus ? ROLLBACK_LABELS[failedAtStatus] || 'previous stage' : 'previous stage';

  async function handleRetry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/retry`, { method: 'POST' });
      if (res.ok) onRecovered();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetrying(false);
    }
  }

  async function handleRollback() {
    setRollingBack(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/rollback`, { method: 'POST' });
      if (res.ok) onRecovered();
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <div className="rounded-xl border border-magenta/30 bg-magenta/5 p-5">
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 12 12" className="mt-0.5 h-5 w-5 flex-shrink-0 text-magenta" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9" />
          <line x1="9" y1="3" x2="3" y2="9" />
        </svg>
        <div className="flex-1">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-magenta">
            KO{failedAtStatus ? ` at ${stageLabel}` : ''}
          </h3>
          {errorMessage && (
            <p className="mt-1 text-sm text-text-secondary">{errorMessage}</p>
          )}

          {failedAtStatus && (
            <div className="mt-4">
              <CommandMenu
                actions={[
                  {
                    label: `Retry ${stageLabel}`,
                    onClick: handleRetry,
                    disabled: retrying || rollingBack,
                    loading: retrying,
                    variant: 'primary',
                  },
                  {
                    label: `Back to ${rollbackLabel}`,
                    onClick: handleRollback,
                    disabled: retrying || rollingBack,
                    loading: rollingBack,
                    variant: 'secondary',
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==============================
   Scripting Progress Sub-component
   ============================== */

function ScriptingProgress({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();

    function tick() {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const display = elapsed < 60 ? `${elapsed}s` : `${mins}m ${secs.toString().padStart(2, '0')}s`;

  return (
    <div className="rounded-xl border border-electric/20 bg-electric/5 p-6">
      <div className="flex items-start gap-4">
        <div className="relative h-8 w-8 flex-shrink-0">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-electric" />
          <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-electric-dim" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-electric">
              Generating Script
            </h3>
            <span className="font-[family-name:var(--font-mono)] text-xs text-text-muted flex-shrink-0">
              {display}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-text-secondary">
            Crafting a 40-second TikTok script with hooks, shots, and energy arcs...
          </p>
        </div>
      </div>
    </div>
  );
}

/* ==============================
   Project Settings (R1.5.2)
   ============================== */

const SETTINGS_REVIEW_GATES = [
  'analysis_review',
  'script_review',
  'broll_review',
  'influencer_selection',
  'casting_review',
  'asset_review',
];

interface SettingsCharacter {
  id: string;
  name: string;
  avatar_persona: string | null;
}

interface SettingsInfluencer {
  id: string;
  name: string;
  persona: string | null;
  image_url: string | null;
}

interface SettingsVideoModel {
  id: string;
  name: string;
  slug: string;
  provider: string;
  total_duration: number;
  segment_count: number;
  resolution: string;
  is_default: boolean;
}

function ProjectSettings({ project, onUpdated }: { project: ProjectData; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [tone, setTone] = useState(project.tone || 'reluctant-insider');
  const [characterId, setCharacterId] = useState(project.character_id || '');
  const [influencerId, setInfluencerId] = useState(project.influencer_id || '');
  const [projectName, setProjectName] = useState(project.name || '');
  const [characters, setCharacters] = useState<SettingsCharacter[]>([]);
  const [influencers, setInfluencers] = useState<SettingsInfluencer[]>([]);
  const [videoModels, setVideoModels] = useState<SettingsVideoModel[]>([]);
  const [videoModelId, setVideoModelId] = useState(project.video_model_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [togglingFastMode, setTogglingFastMode] = useState(false);
  const [updatingRetries, setUpdatingRetries] = useState(false);

  async function handleToggleFastMode() {
    setTogglingFastMode(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fast_mode: !project.fast_mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to toggle fast mode');
        return;
      }
      onUpdated();
    } catch {
      setError('Failed to toggle fast mode');
    } finally {
      setTogglingFastMode(false);
    }
  }

  async function handleChangeRetries(delta: number) {
    const current = project.video_retries ?? 0;
    const next = Math.max(0, Math.min(3, current + delta));
    if (next === current) return;
    setUpdatingRetries(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_retries: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to update retries');
        return;
      }
      onUpdated();
    } catch {
      setError('Failed to update retries');
    } finally {
      setUpdatingRetries(false);
    }
  }

  const isReviewGate = SETTINGS_REVIEW_GATES.includes(project.status);

  // Sync state when project changes externally
  useEffect(() => {
    setTone(project.tone || 'reluctant-insider');
    setCharacterId(project.character_id || '');
    setInfluencerId(project.influencer_id || '');
    setProjectName(project.name || '');
    setVideoModelId(project.video_model_id || '');
  }, [project.tone, project.character_id, project.influencer_id, project.name, project.video_model_id]);

  // Fetch options when entering edit mode
  useEffect(() => {
    if (!editing) return;
    fetch('/api/characters')
      .then((r) => (r.ok ? r.json() : []))
      .then(setCharacters)
      .catch(() => setCharacters([]));
    fetch('/api/influencers')
      .then((r) => (r.ok ? r.json() : []))
      .then(setInfluencers)
      .catch(() => setInfluencers([]));
    fetch('/api/video-models')
      .then((r) => (r.ok ? r.json() : { videoModels: [] }))
      .then((data: { videoModels: SettingsVideoModel[] }) => setVideoModels(data.videoModels))
      .catch(() => setVideoModels([]));
  }, [editing]);

  function handleCancel() {
    setTone(project.tone || 'reluctant-insider');
    setCharacterId(project.character_id || '');
    setInfluencerId(project.influencer_id || '');
    setProjectName(project.name || '');
    setVideoModelId(project.video_model_id || '');
    setError('');
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    const updates: Record<string, unknown> = {};
    if (tone !== (project.tone || 'reluctant-insider')) updates.tone = tone;
    if (characterId !== (project.character_id || '')) updates.character_id = characterId || null;
    if (influencerId !== (project.influencer_id || '')) updates.influencer_id = influencerId || null;
    if (projectName !== (project.name || '')) updates.name = projectName || null;
    if (videoModelId !== (project.video_model_id || '')) updates.video_model_id = videoModelId || null;

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      setEditing(false);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(''), 2000);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const toneLabel = project.tone && SCRIPT_TONES[project.tone as keyof typeof SCRIPT_TONES]
    ? SCRIPT_TONES[project.tone as keyof typeof SCRIPT_TONES].label
    : 'Default';

  if (editing) {
    return (
      <div className="rounded-xl border border-electric/20 bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-wider text-electric">
            Edit Settings
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-border px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-medium text-text-muted transition-colors hover:text-text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-electric px-3 py-1.5 font-[family-name:var(--font-display)] text-xs font-semibold text-void transition-all hover:shadow-[0_0_16px_rgba(0,240,255,0.3)] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" strokeLinecap="round" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>

        {/* Project Name */}
        <div>
          <label className="mb-1.5 block font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Optional project name..."
            className="block w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
          />
        </div>

        {/* Tone */}
        <div>
          <label className="mb-1.5 block font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Script Tone
          </label>
          <ToneSelector value={tone} onChange={setTone} compact />
        </div>

        {/* Character */}
        <div>
          <label className="mb-1.5 block font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Character
          </label>
          <div className="relative">
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-3 py-2 pr-9 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            >
              <option value="">Auto-detect from product category</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.avatar_persona ? ` (${c.avatar_persona})` : ''}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>
        </div>

        {/* Influencer */}
        <div>
          <label className="mb-1.5 block font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Influencer
          </label>
          <div className="relative">
            <select
              value={influencerId}
              onChange={(e) => setInfluencerId(e.target.value)}
              className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-3 py-2 pr-9 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
            >
              <option value="">No influencer selected</option>
              {influencers.map((inf) => (
                <option key={inf.id} value={inf.id}>
                  {inf.name}{inf.persona ? ` — ${inf.persona.split(/\s+/).slice(0, 4).join(' ')}` : ''}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>
        </div>

        {/* Video Model */}
        {videoModels.length > 0 && (
          <div>
            <label className="mb-1.5 block font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Video Model
            </label>
            <div className="relative">
              <select
                value={videoModelId}
                onChange={(e) => setVideoModelId(e.target.value)}
                className="block w-full appearance-none rounded-lg border border-border bg-surface-raised px-3 py-2 pr-9 text-sm text-text-primary transition-all focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
              >
                {videoModels.map((vm) => (
                  <option key={vm.id} value={vm.id}>
                    {vm.name} — {vm.total_duration}s, {vm.segment_count} segments
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 6 8 10 12 6" />
              </svg>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-magenta/30 bg-magenta/10 px-3 py-2">
            <p className="text-xs text-magenta">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Compact read-only view
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-[family-name:var(--font-display)] text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Settings
        </span>

        {/* Tone badge */}
        <span className="inline-flex rounded-full border border-electric/20 bg-electric/5 px-2.5 py-0.5 font-[family-name:var(--font-display)] text-[11px] font-medium text-electric">
          {toneLabel}
        </span>

        {/* Character badge */}
        {project.character && (
          <span className="inline-flex rounded-full border border-magenta/20 bg-magenta/5 px-2.5 py-0.5 font-[family-name:var(--font-display)] text-[11px] font-medium text-magenta">
            {project.character.name}
          </span>
        )}

        {/* Influencer badge */}
        {project.influencer && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/20 bg-lime/5 px-2.5 py-0.5 font-[family-name:var(--font-display)] text-[11px] font-medium text-lime">
            {project.influencer.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.influencer.image_url}
                alt=""
                className="h-3.5 w-3.5 rounded-full object-cover"
              />
            )}
            {project.influencer.name}
          </span>
        )}

        {/* Video model badge */}
        {project.video_model && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-hot/20 bg-amber-hot/5 px-2.5 py-0.5 font-[family-name:var(--font-display)] text-[11px] font-medium text-amber-hot">
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <path d="M6.5 6.5l3 2-3 2v-4z" fill="currentColor" stroke="none" />
            </svg>
            {project.video_model.name}
          </span>
        )}

        {/* Fast Mode toggle */}
        <button
          type="button"
          onClick={handleToggleFastMode}
          disabled={togglingFastMode}
          className="group inline-flex items-center gap-1.5"
          title="Auto-approve review gates. Pipeline runs without pausing for review."
        >
          <div className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${project.fast_mode ? 'bg-amber-hot' : 'bg-surface-overlay'}`}>
            <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-200 ${project.fast_mode ? 'left-3.5' : 'left-0.5'}`} />
          </div>
          <span className={`font-[family-name:var(--font-display)] text-[11px] font-medium transition-colors ${project.fast_mode ? 'text-amber-hot' : 'text-text-muted group-hover:text-text-secondary'}`}>
            Fast Mode
          </span>
        </button>

        {/* Video Retries stepper */}
        <div className="inline-flex items-center gap-1.5" title="Number of automatic retries on video generation failure (0 = no retries)">
          <div className="inline-flex items-center rounded-full border border-border/60 bg-surface-overlay/40">
            <button
              type="button"
              onClick={() => handleChangeRetries(-1)}
              disabled={updatingRetries || (project.video_retries ?? 0) <= 0}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-text-muted transition-colors hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M2.5 6h7" />
              </svg>
            </button>
            <span className={`min-w-[14px] text-center font-[family-name:var(--font-display)] text-[11px] font-semibold tabular-nums transition-colors ${(project.video_retries ?? 0) > 0 ? 'text-amber-hot' : 'text-text-muted'}`}>
              {project.video_retries ?? 0}
            </span>
            <button
              type="button"
              onClick={() => handleChangeRetries(1)}
              disabled={updatingRetries || (project.video_retries ?? 0) >= 3}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-text-muted transition-colors hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 2.5v7M2.5 6h7" />
              </svg>
            </button>
          </div>
          <span className={`font-[family-name:var(--font-display)] text-[11px] font-medium transition-colors ${(project.video_retries ?? 0) > 0 ? 'text-amber-hot' : 'text-text-muted'}`}>
            Retries
          </span>
        </div>

        {/* Success feedback */}
        {success && (
          <span className="font-[family-name:var(--font-display)] text-[11px] font-medium text-lime animate-fade-in-up">
            {success}
          </span>
        )}

        {/* Edit button — only at review gates */}
        {isReviewGate && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-[family-name:var(--font-display)] text-[11px] font-medium text-text-muted transition-colors hover:border-electric/30 hover:text-electric"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
            </svg>
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Lock Camera Toggle ─────────────────────────────────────────────── */
function LockCameraToggle({
  projectId,
  lockCamera,
  onUpdated,
  readOnly,
}: {
  projectId: string;
  lockCamera: boolean;
  onUpdated: () => void;
  readOnly?: boolean;
}) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    if (readOnly) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock_camera: !lockCamera }),
      });
      if (res.ok) {
        onUpdated();
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="glass flex items-center justify-between rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        {/* Camera lock icon */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`h-3.5 w-3.5 transition-colors ${lockCamera ? 'text-electric' : 'text-text-muted'}`}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="1" y="4" width="10" height="8" rx="1.5" />
          <path d="M11 7l4-2v6l-4-2v-2z" />
          {lockCamera && <path d="M3 7.5l1.5 1.5L7 6.5" strokeWidth={1.5} />}
        </svg>
        <div className="flex flex-col">
          <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-secondary">
            Lock Camera
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
            Static camera, no movement
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling || readOnly}
        className="group inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        title={lockCamera ? 'Camera is locked — no movement during video generation' : 'Camera is free — default movement allowed'}
      >
        <div
          className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
            lockCamera ? 'bg-electric' : 'bg-surface-overlay'
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
              lockCamera ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </div>
      </button>
    </div>
  );
}

/* ── Keyframe Chaining Toggle ─────────────────────────────────────── */
function KeyframeChainingToggle({
  projectId,
  chainingEnabled,
  onUpdated,
  readOnly,
}: {
  projectId: string;
  chainingEnabled: boolean;
  onUpdated: () => void;
  readOnly?: boolean;
}) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    if (readOnly) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyframe_chaining: !chainingEnabled }),
      });
      if (res.ok) {
        onUpdated();
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="glass flex items-center justify-between rounded-lg px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        {/* Chain link icon */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`h-3.5 w-3.5 transition-colors ${chainingEnabled ? 'text-electric' : 'text-text-muted'}`}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6.5 9.5l3-3" />
          <path d="M9 11l1.5-1.5a2.83 2.83 0 0 0-4-4L5 7" />
          <path d="M7 5L5.5 6.5a2.83 2.83 0 0 0 4 4L11 9" />
        </svg>
        <div className="flex flex-col">
          <span className="font-[family-name:var(--font-display)] text-xs font-semibold text-text-secondary">
            Chain Keyframes
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-muted">
            Each segment starts from the previous end frame
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling || readOnly}
        className="group inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        title={chainingEnabled
          ? 'When enabled, each segment\u2019s start frame reuses the previous end frame for visual continuity'
          : 'When disabled, each segment generates its start frame independently'}
      >
        <div
          className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${
            chainingEnabled ? 'bg-electric' : 'bg-surface-overlay'
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
              chainingEnabled ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </div>
      </button>
    </div>
  );
}
